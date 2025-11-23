#include "../lib/startup.h"
#include "../lib/ports.h"
#include <Arduino.h>

void startup_initPins() {
  pinMode(V_DETECT_1, INPUT);
  pinMode(V_DETECT_2, INPUT);
  pinMode(V_DETECT_3, INPUT);
  pinMode(V_DETECT_4, INPUT);

  pinMode(IOT_LINK_LED, OUTPUT);
  pinMode(IOT_RUN_LED, OUTPUT);

  pinMode(BTN_1, INPUT_PULLUP);
  pinMode(BTN_2, INPUT_PULLUP);
  pinMode(BTN_3, INPUT_PULLUP);
  pinMode(BTN_4, INPUT_PULLUP);
}

void startup_initSerial(unsigned long baud) {
  Serial.begin(baud);
}
