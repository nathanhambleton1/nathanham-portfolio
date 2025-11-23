#ifndef STARTUP_H
#define STARTUP_H

#include <Arduino.h>

// Initialize board pins (V_DETECT, LEDs, buttons)
void startup_initPins();

// Initialize serial console (debug)
void startup_initSerial(unsigned long baud = 115200);

#endif // STARTUP_H
