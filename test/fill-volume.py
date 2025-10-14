#!/usr/bin/env python3

"""
Fill ONTAP Volume to 91% Capacity using NFS mount
Usage: ./fill-volume.py <cluster_name> <svm_name> <volume_name>

This script:
1. Reads cluster credentials from test/clusters.json
2. Gets volume size via ONTAP REST API
3. Calculates 91% fill size
4. Mounts volume via NFS and uses dd to fill it
"""

import sys
import json
import subprocess
import os
import time
import ssl
import urllib.request
import urllib.parse
import base64
from pathlib import Path

def main():
    if len(sys.argv) != 5:
        print("Usage: ./fill-volume.py <cluster_name> <svm_name> <volume_name> <fill_percentage>")
        print("")
        print("Example: ./fill-volume.py greg-vsim-1 vs0 full_vol_1 95")
        print("  This will fill the volume to 95% capacity")
        print("")
        print("Available clusters in clusters.json:")
        try:
            with open('test/clusters.json') as f:
                clusters = json.load(f)
                for name in clusters.keys():
                    print(f"  - {name}")
        except:
            print("  (clusters.json not found)")
        sys.exit(1)

    cluster_name = sys.argv[1]
    svm_name = sys.argv[2]
    volume_name = sys.argv[3]
    
    try:
        fill_percentage = int(sys.argv[4])
        if fill_percentage < 1 or fill_percentage > 99:
            print("Error: Fill percentage must be between 1 and 99")
            sys.exit(1)
    except ValueError:
        print("Error: Fill percentage must be a valid integer")
        sys.exit(1)
    
    # Load cluster credentials
    clusters_file = 'test/clusters.json'
    try:
        with open(clusters_file) as f:
            clusters = json.load(f)
    except FileNotFoundError:
        print(f"Error: {clusters_file} not found")
        sys.exit(1)
    
    if cluster_name not in clusters:
        print(f"Error: Cluster '{cluster_name}' not found in {clusters_file}")
        print("\nAvailable clusters:")
        for name in clusters.keys():
            print(f"  - {name}")
        sys.exit(1)
    
    cluster = clusters[cluster_name]
    cluster_ip = cluster['cluster_ip']
    username = cluster['username']
    password = cluster['password']
    
    print("=" * 48)
    print("ONTAP Volume Fill Utility")
    print("=" * 48)
    print(f"Cluster:  {cluster_name} ({cluster_ip})")
    print(f"SVM:      {svm_name}")
    print(f"Volume:   {volume_name}")
    print(f"Target:   {fill_percentage}% full")
    print("=" * 48)
    print("")
    
    # Step 1: Get volume information via REST API
    print("📊 Fetching volume information...")
    api_url = f"https://{cluster_ip}/api/storage/volumes?name={volume_name}&svm.name={svm_name}&fields=uuid,size,space,nas.path"
    
    # Create SSL context that doesn't verify certificates
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # Create auth header
    auth_string = f"{username}:{password}"
    auth_bytes = auth_string.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    try:
        req = urllib.request.Request(api_url)
        req.add_header('Authorization', f'Basic {auth_b64}')
        with urllib.request.urlopen(req, context=ctx) as response:
            volume_info = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Error: Failed to connect to ONTAP API: {e}")
        sys.exit(1)
    
    if volume_info.get('num_records', 0) == 0:
        print(f"❌ Error: Volume '{volume_name}' not found in SVM '{svm_name}'")
        sys.exit(1)
    
    volume = volume_info['records'][0]
    volume_uuid = volume['uuid']
    volume_size_bytes = volume['space']['size']
    current_used_bytes = volume['space'].get('used', 0)
    
    volume_size_gb = volume_size_bytes / (1024**3)
    current_used_gb = current_used_bytes / (1024**3)
    target_used_bytes = int(volume_size_bytes * (fill_percentage / 100))
    target_used_gb = target_used_bytes / (1024**3)
    bytes_to_fill = target_used_bytes - current_used_bytes
    mb_to_fill = int(bytes_to_fill / (1024**2))
    
    print(f"✅ Volume found: {volume_uuid}")
    print("")
    print("Volume Details:")
    print(f"  Total size:     {volume_size_gb:.2f} GB ({volume_size_bytes} bytes)")
    print(f"  Currently used: {current_used_gb:.2f} GB ({current_used_bytes} bytes)")
    print(f"  Target {fill_percentage}%:     {target_used_gb:.2f} GB ({target_used_bytes} bytes)")
    print(f"  Need to fill:   {bytes_to_fill/(1024**3):.2f} GB ({bytes_to_fill} bytes)")
    print("")
    
    # Check if already at or above target
    if bytes_to_fill <= 0:
        current_pct = (current_used_bytes / volume_size_bytes) * 100
        print(f"✅ Volume is already {current_pct:.1f}% full (target is {fill_percentage}%)")
        print("No fill operation needed.")
        return
    
    # Step 2: Get NFS data LIF
    print("🔗 Finding NFS data LIF for SVM...")
    lif_url = f"https://{cluster_ip}/api/network/ip/interfaces?svm.name={svm_name}&services=data_nfs&fields=ip.address"
    
    try:
        req = urllib.request.Request(lif_url)
        req.add_header('Authorization', f'Basic {auth_b64}')
        with urllib.request.urlopen(req, context=ctx) as response:
            lif_info = json.loads(response.read().decode())
    except Exception as e:
        print(f"❌ Error: Failed to get NFS LIF: {e}")
        sys.exit(1)
    
    if lif_info.get('num_records', 0) == 0:
        print(f"❌ Error: No NFS data LIF found for SVM '{svm_name}'")
        print("   The SVM must have NFS configured with a data LIF.")
        sys.exit(1)
    
    data_lif = lif_info['records'][0]['ip']['address']
    print(f"✅ Found NFS data LIF: {data_lif}")
    print("")
    
    # Step 2.6: Verify export policy allows access
    print("🔒 Checking NFS export policy...")
    export_policy_name = volume.get('nas', {}).get('export_policy', {}).get('name', 'default')
    
    # Check if default policy has open access (0.0.0.0/0)
    export_url = f"https://{cluster_ip}/api/protocols/nfs/export-policies?name={export_policy_name}&svm.name={svm_name}&fields=rules"
    
    try:
        req = urllib.request.Request(export_url)
        req.add_header('Authorization', f'Basic {auth_b64}')
        with urllib.request.urlopen(req, context=ctx) as response:
            export_info = json.loads(response.read().decode())
        
        if export_info.get('num_records', 0) > 0:
            rules = export_info['records'][0].get('rules', [])
            has_open_access = any(
                '0.0.0.0/0' in [c.get('match') for c in rule.get('clients', [])]
                for rule in rules
            )
            
            if has_open_access:
                print(f"✅ Export policy '{export_policy_name}' allows NFS access")
            else:
                print(f"⚠️  Export policy '{export_policy_name}' may not allow this host")
                print(f"   Proceeding anyway - mount may fail if access denied")
        else:
            print(f"⚠️  Export policy '{export_policy_name}' not found, proceeding anyway")
    except Exception as e:
        print(f"⚠️  Could not verify export policy: {e}")
        print("   Proceeding anyway - mount may fail if access denied")
    
    print("")
    
    # Step 2.5: Get or set volume junction path
    junction_path = volume.get('nas', {}).get('path')
    if not junction_path:
        print(f"⚠️  Volume has no junction path, setting to /{volume_name}...")
        junction_path = f"/{volume_name}"
        
        # Set junction path via API
        update_url = f"https://{cluster_ip}/api/storage/volumes/{volume_uuid}"
        update_data = {"nas": {"path": junction_path}}
        
        try:
            req = urllib.request.Request(update_url, method='PATCH')
            req.add_header('Authorization', f'Basic {auth_b64}')
            req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req, data=json.dumps(update_data).encode(), context=ctx) as response:
                result = json.loads(response.read().decode())
            
            # Wait for job to complete
            time.sleep(2)
            print(f"✅ Junction path set to: {junction_path}")
        except Exception as e:
            print(f"❌ Error setting junction path: {e}")
            sys.exit(1)
    else:
        print(f"✅ Junction path: {junction_path}")
    
    print("")
    
    # Step 3: Mount volume via NFS
    mount_point = f"/tmp/ontap_fill_{os.getpid()}"
    os.makedirs(mount_point, exist_ok=True)
    
    print("📁 Mounting volume via NFS...")
    print(f"   Mount: {data_lif}:{junction_path} -> {mount_point}")
    
    mount_cmd = ["sudo", "mount", "-t", "nfs", "-o", "vers=3,nolock", 
                 f"{data_lif}:{junction_path}", mount_point]
    
    try:
        subprocess.run(mount_cmd, check=True, capture_output=True, text=True)
        print("✅ Volume mounted successfully")
        print("")
    except subprocess.CalledProcessError as e:
        print("❌ Error: Failed to mount NFS volume")
        print(f"   {e.stderr}")
        print("   This might be due to:")
        print("   1. Export policy doesn't allow this host")
        print("   2. NFS not enabled on SVM")
        print("   3. Network connectivity issues")
        os.rmdir(mount_point)
        sys.exit(1)
    
    # Step 4: Write fill file using dd with random data
    print(f"💾 Writing fill file ({mb_to_fill} MB)...")
    print("   Using random data to prevent compression...")
    print("   This may take a few moments...")
    
    # Use timestamp to create unique filename each run (prevents overwriting)
    import datetime
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    fill_file = os.path.join(mount_point, f"fillfile_{timestamp}.dat")
    
    # Use /dev/urandom instead of /dev/zero to prevent ONTAP compression/dedup
    # Run with sudo for write permissions on NFS mount
    dd_cmd = ["sudo", "dd", "if=/dev/urandom", f"of={fill_file}", "bs=1048576", f"count={mb_to_fill}"]
    
    try:
        result = subprocess.run(dd_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ dd command failed: {result.stderr}")
            subprocess.run(["sudo", "umount", mount_point], capture_output=True)
            os.rmdir(mount_point)
            sys.exit(1)
        print("✅ Fill file created")
        # Show dd stats
        if result.stderr:
            print(f"   {result.stderr.strip()}")
        print("")
    except Exception as e:
        print(f"❌ Error writing fill file: {e}")
        # Try to unmount before exiting
        subprocess.run(["sudo", "umount", mount_point], capture_output=True)
        os.rmdir(mount_point)
        sys.exit(1)
    
    # Step 5: Unmount
    print("🔓 Unmounting volume...")
    try:
        subprocess.run(["sudo", "umount", mount_point], check=True, capture_output=True, timeout=10)
        os.rmdir(mount_point)
        print("✅ Unmount complete")
    except subprocess.CalledProcessError:
        # Try force unmount
        print("⚠️  Normal unmount failed, trying force unmount...")
        try:
            subprocess.run(["sudo", "umount", "-f", mount_point], check=True, capture_output=True, timeout=10)
            os.rmdir(mount_point)
            print("✅ Force unmount complete")
        except:
            print("⚠️  Warning: Failed to unmount cleanly - mount may still be active")
            print(f"   Manual cleanup: sudo umount -f {mount_point} && rmdir {mount_point}")
    except subprocess.TimeoutExpired:
        print("⚠️  Unmount timed out, trying force unmount...")
        try:
            subprocess.run(["sudo", "umount", "-f", mount_point], check=True, capture_output=True, timeout=10)
            os.rmdir(mount_point)
            print("✅ Force unmount complete")
        except:
            print("⚠️  Warning: Failed to unmount - mount may still be active")
            print(f"   Manual cleanup: sudo umount -f {mount_point} && rmdir {mount_point}")
    
    print("")
    print("=" * 48)
    print("✅ Volume fill complete!")
    print("=" * 48)
    print("")
    
    # Step 6: Verify
    print("🔍 Verifying new volume capacity...")
    time.sleep(2)  # Give ONTAP a moment to update stats
    
    try:
        req = urllib.request.Request(api_url)
        req.add_header('Authorization', f'Basic {auth_b64}')
        with urllib.request.urlopen(req, context=ctx) as response:
            volume_info_after = json.loads(response.read().decode())
        new_used_bytes = volume_info_after['records'][0]['space']['used']
        new_used_gb = new_used_bytes / (1024**3)
        new_pct = (new_used_bytes / volume_size_bytes) * 100
        
        print("New volume status:")
        print(f"  Used: {new_used_gb:.2f} GB ({new_used_bytes} bytes)")
        print(f"  Percentage: {new_pct:.1f}%")
        print("")
        
        # Success if within 0.5% of target
        if new_pct >= (fill_percentage - 0.5):
            print(f"✅ SUCCESS: Volume is now {new_pct:.1f}% full (target was {fill_percentage}%)")
        else:
            print(f"⚠️  Warning: Volume is {new_pct:.1f}% full (expected ~{fill_percentage}%)")
            print("   This may be due to filesystem overhead or ONTAP metadata.")
        
        print("")
        print("To clean up fill files later, run:")
        print(f"  sudo mount -t nfs {data_lif}:{junction_path} /mnt/temp")
        print(f"  sudo rm /mnt/temp/fillfile_*.dat")
        print(f"  sudo umount /mnt/temp")
        print("")
    except Exception as e:
        print(f"⚠️  Could not verify final capacity: {e}")

if __name__ == '__main__':
    main()
