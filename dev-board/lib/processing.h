#ifndef PROCESSING_H
#define PROCESSING_H

#include <Arduino.h>

// Build telemetry JSON payload from sensor values and button states
String process_buildTelemetry(int v1, int v2, int v3, int v4, bool b1, bool b2, bool b3, bool b4);

// Handle a command received from the commands table. `id` may be -1 if unknown
void process_handleCommand(const String &cmd, const String &payload, long id = -1);

#endif // PROCESSING_H
