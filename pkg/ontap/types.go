package ontap

// SVM represents a Storage Virtual Machine
type SVM struct {
	UUID    string `json:"uuid"`
	Name    string `json:"name"`
	State   string `json:"state"`
	Subtype string `json:"subtype,omitempty"`
}

// Aggregate represents a storage aggregate
type Aggregate struct {
	UUID       string `json:"uuid"`
	Name       string `json:"name"`
	State      string `json:"state"`
	Space      *AggregateSpace `json:"space,omitempty"`
	BlockStorage *struct {
		Primary *struct {
			DiskCount int    `json:"disk_count"`
			RaidType  string `json:"raid_type"`
		} `json:"primary,omitempty"`
	} `json:"block_storage,omitempty"`
}

// AggregateSpace represents aggregate space information
type AggregateSpace struct {
	BlockStorage *struct {
		Size      int64 `json:"size"`
		Available int64 `json:"available"`
		Used      int64 `json:"used"`
	} `json:"block_storage,omitempty"`
}

// Volume represents a storage volume
type Volume struct {
	UUID  string `json:"uuid"`
	Name  string `json:"name"`
	State string `json:"state"`
	Type  string `json:"type,omitempty"`
	Style string `json:"style,omitempty"`
	SVM   *struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"svm,omitempty"`
	Aggregates []struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"aggregates,omitempty"`
	Space *VolumeSpace `json:"space,omitempty"`
	NAS   *VolumeNAS   `json:"nas,omitempty"`
	QoS   *VolumeQoS   `json:"qos,omitempty"`
}

// VolumeSpace represents volume space information
type VolumeSpace struct {
	Size            int64  `json:"size,omitempty"`
	Available       int64  `json:"available,omitempty"`
	Used            int64  `json:"used,omitempty"`
	LogicalSpace    *struct {
		Used      int64 `json:"used,omitempty"`
		Available int64 `json:"available,omitempty"`
	} `json:"logical_space,omitempty"`
	Snapshot *struct {
		Used              int64 `json:"used,omitempty"`
		ReservePercent    int   `json:"reserve_percent,omitempty"`
	} `json:"snapshot,omitempty"`
}

// VolumeNAS represents NFS/CIFS configuration
type VolumeNAS struct {
	Path         string `json:"path,omitempty"`
	SecurityStyle string `json:"security_style,omitempty"`
	ExportPolicy *struct {
		Name string `json:"name,omitempty"`
		ID   int    `json:"id,omitempty"`
	} `json:"export_policy,omitempty"`
}

// VolumeQoS represents QoS policy assignment
type VolumeQoS struct {
	Policy *struct {
		UUID string `json:"uuid,omitempty"`
		Name string `json:"name,omitempty"`
	} `json:"policy,omitempty"`
}

// CreateVolumeRequest represents volume creation parameters
type CreateVolumeRequest struct {
	Name       string                 `json:"name"`
	SVM        map[string]string      `json:"svm"`
	Size       int64                  `json:"size"`
	Aggregates []map[string]string    `json:"aggregates,omitempty"`
	QoS        map[string]interface{} `json:"qos,omitempty"`
	Space      map[string]interface{} `json:"space,omitempty"`
	NAS        map[string]interface{} `json:"nas,omitempty"`
	Type       string                 `json:"type,omitempty"`
	Style      string                 `json:"style,omitempty"`
	Comment    string                 `json:"comment,omitempty"`
}

// CreateVolumeResponse represents volume creation response
type CreateVolumeResponse struct {
	Job *struct {
		UUID string `json:"uuid"`
	} `json:"job,omitempty"`
	UUID string `json:"uuid,omitempty"`
	Name string `json:"name,omitempty"`
}

// CIFSShare represents a CIFS/SMB share
type CIFSShare struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	SVM     *struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"svm,omitempty"`
	Comment string `json:"comment,omitempty"`
	ACLs    []CIFSACL `json:"acls,omitempty"`
}

// CIFSACL represents a CIFS access control entry
type CIFSACL struct {
	UserOrGroup string `json:"user_or_group"`
	Permission  string `json:"permission"`
	Type        string `json:"type,omitempty"`
}

// ExportPolicy represents an NFS export policy
type ExportPolicy struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	SVM   *struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"svm,omitempty"`
	Rules []ExportRule `json:"rules,omitempty"`
}

// ExportRule represents an export policy rule
type ExportRule struct {
	Index              int              `json:"index"`
	Clients            []ExportClient   `json:"clients,omitempty"`
	Protocols          []string         `json:"protocols,omitempty"`
	RoRule             []string         `json:"ro_rule,omitempty"`
	RwRule             []string         `json:"rw_rule,omitempty"`
	Superuser          []string         `json:"superuser,omitempty"`
	AnonymousUser      string           `json:"anonymous_user,omitempty"`
	AllowDeviceCreation bool            `json:"allow_device_creation,omitempty"`
	AllowSuid          bool             `json:"allow_suid,omitempty"`
}

// ExportClient represents an NFS client specification
type ExportClient struct {
	Match string `json:"match"`
}

// SnapshotPolicy represents a snapshot policy
type SnapshotPolicy struct {
	UUID    string `json:"uuid"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Comment string `json:"comment,omitempty"`
	Copies  []struct {
		Count     int    `json:"count"`
		Prefix    string `json:"prefix,omitempty"`
		Schedule  *struct {
			Name string `json:"name"`
		} `json:"schedule,omitempty"`
		Retention string `json:"retention_period,omitempty"`
	} `json:"copies,omitempty"`
	SVM *struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"svm,omitempty"`
}

// QoSPolicy represents a QoS policy
type QoSPolicy struct {
	UUID  string `json:"uuid"`
	Name  string `json:"name"`
	SVM   *struct {
		UUID string `json:"uuid"`
		Name string `json:"name"`
	} `json:"svm,omitempty"`
	PolicyClass string `json:"policy_class,omitempty"`
	Fixed       *struct {
		MaxThroughputIOPS int64 `json:"max_throughput_iops,omitempty"`
		MaxThroughputMBPS int64 `json:"max_throughput_mbps,omitempty"`
		MinThroughputIOPS int64 `json:"min_throughput_iops,omitempty"`
	} `json:"fixed,omitempty"`
	Adaptive *struct {
		ExpectedIOPS          int64  `json:"expected_iops,omitempty"`
		ExpectedIOPSAllocation string `json:"expected_iops_allocation,omitempty"`
		PeakIOPS              int64  `json:"peak_iops,omitempty"`
		PeakIOPSAllocation    string `json:"peak_iops_allocation,omitempty"`
	} `json:"adaptive,omitempty"`
}

// VolumeSnapshot represents a volume snapshot
type VolumeSnapshot struct {
	UUID       string `json:"uuid"`
	Name       string `json:"name"`
	CreateTime string `json:"create_time"`
	Size       int64  `json:"size,omitempty"`
	State      string `json:"state,omitempty"`
	Comment    string `json:"comment,omitempty"`
}

// VolumeAutosize represents volume autosize configuration
type VolumeAutosize struct {
	Mode              string `json:"mode"`
	GrowThreshold     int    `json:"grow_threshold,omitempty"`
	ShrinkThreshold   int    `json:"shrink_threshold,omitempty"`
	Maximum           int64  `json:"maximum,omitempty"`
	Minimum           int64  `json:"minimum,omitempty"`
}

// SnapshotSchedule represents a snapshot schedule (cron job)
type SnapshotSchedule struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
	Type string `json:"type,omitempty"` // cron, interval
}
