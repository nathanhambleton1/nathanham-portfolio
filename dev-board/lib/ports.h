#ifndef PORTS_H
#define PORTS_H

// V_DETECT pins
#define V_DETECT_1  0  // P1.0
#define V_DETECT_2  1  // P1.1
#define V_DETECT_3  2  // P1.2
#define V_DETECT_4  3  // P1.3

// LED pins
#define IOT_LINK_LED 4 // P1.4
#define IOT_RUN_LED  5 // P1.5

// Button pins (SW2/SW3 network)
#define BTN_1 18 // P3.2
#define BTN_2 19 // P3.3
#define BTN_3 21 // P3.5
#define BTN_4 22 // P3.6

// UCA0 hardware UART (connected to ESP on this board)
// These are the port bit numbers for P1.6 / P1.7
#define UCA0_RX_PIN 6 // P1.6 (UCA0RXD)
#define UCA0_TX_PIN 7 // P1.7 (UCA0TXD)

#endif // PORTS_H
