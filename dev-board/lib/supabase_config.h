#ifndef SUPABASE_CONFIG_H
#define SUPABASE_CONFIG_H

// Supabase REST host and anon key
// WARNING: Storing the anon key on a device is a security risk for public devices.
// This is provided for local/dev usage only. Consider using a proxy or short-lived
// tokens for production devices.
#define SUPABASE_HOST "kcyrvubzhsphpxfsewii.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI"

// REST paths
#define SUPABASE_TELEMETRY_PATH "/rest/v1/telemetry"
#define SUPABASE_COMMANDS_PATH "/rest/v1/commands"
// Status table path
#define SUPABASE_STATUS_PATH "/rest/v1/device_status"

// Device identifier for this firmware (single-device setup)
#define DEVICE_ID "device-001"

#endif // SUPABASE_CONFIG_H
