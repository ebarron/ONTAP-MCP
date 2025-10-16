package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// ServeStdio runs the MCP server in STDIO mode (for VS Code integration)
func (s *Server) ServeStdio(ctx context.Context) error {
	s.logger.Info().Msg("STDIO transport started")

	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)

	for {
		select {
		case <-ctx.Done():
			s.logger.Info().Msg("STDIO transport shutting down")
			return ctx.Err()
		default:
			// Read JSON-RPC request from stdin
			line, err := reader.ReadBytes('\n')
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return fmt.Errorf("failed to read from stdin: %w", err)
			}

			// Parse request
			var req JSONRPCRequest
			if err := json.Unmarshal(line, &req); err != nil {
				s.logger.Error().
					Err(err).
					Str("line", string(line)).
					Msg("Failed to parse JSON-RPC request")

				// Send parse error
				resp := NewJSONRPCError(nil, ErrCodeParseError, "Parse error", err.Error())
				s.writeResponse(writer, resp)
				continue
			}

			// Handle request
			resp := s.HandleRequest(ctx, &req)

			// Write response
			if err := s.writeResponse(writer, resp); err != nil {
				s.logger.Error().
					Err(err).
					Msg("Failed to write response")
				return err
			}
		}
	}
}

// writeResponse writes a JSON-RPC response to stdout
func (s *Server) writeResponse(writer *bufio.Writer, resp *JSONRPCResponse) error {
	respBytes, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("failed to marshal response: %w", err)
	}

	if _, err := writer.Write(respBytes); err != nil {
		return fmt.Errorf("failed to write response: %w", err)
	}

	if err := writer.WriteByte('\n'); err != nil {
		return fmt.Errorf("failed to write newline: %w", err)
	}

	if err := writer.Flush(); err != nil {
		return fmt.Errorf("failed to flush writer: %w", err)
	}

	return nil
}
