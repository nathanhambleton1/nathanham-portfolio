import { useEffect, useRef, useState } from "react";
import { sendCommand, subscribeTelemetry } from "../lib/deviceCommands";
import { supabase } from "../lib/supabase";

const Dev = () => {
    // Placeholder for Voltage In and 4 sensor values
    const [vin, setVin] = useState(12.0);
    const [sensorValues, setSensorValues] = useState([0.0, 0.0, 0.0, 0.0]);
  const [connected, setConnected] = useState(false);
  // last telemetry timestamp (ms since epoch) used as heartbeat
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [lastSensor, setLastSensor] = useState<string | null>(null);
  const [ledState, setLedState] = useState(0);
  // Placeholder states for 8 red LEDs
  const [ledArray, setLedArray] = useState(Array(8).fill(false));
  // States for 2 IoT LEDs (controllable)
  const [iotLeds, setIotLeds] = useState([false, false]);
  // Placeholder states for 2 push-button switches
  const [switchStates, setSwitchStates] = useState([false, false]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isMounted = true;
    let lastSeenId = 0;

    function handleTelemetryRow(row: any) {
      try {
        pushLog(`Telemetry: ${JSON.stringify(row)}`);
        if (!row) return;
        if (row.id && row.id > lastSeenId) lastSeenId = row.id;
        // update heartbeat timestamp when telemetry arrives
        try {
          const ts = row.created_at ? Date.parse(row.created_at) : Date.now();
          setLastTelemetryAt(ts);
        } catch (e) {
          setLastTelemetryAt(Date.now());
        }
        if (row.payload) {
          const p = row.payload;
          setLastSensor(String(row.type ?? JSON.stringify(p)));

          if (row.type === 'sensors') {
            const v1 = Number(p.v1 ?? p.v0 ?? p[0] ?? 0);
            const v2 = Number(p.v2 ?? p.v1 ?? p[1] ?? 0);
            const v3 = Number(p.v3 ?? p.v2 ?? p[2] ?? 0);
            const v4 = Number(p.v4 ?? p.v3 ?? p[3] ?? 0);
            setSensorValues([v1, v2, v3, v4].map((n) => Number(n) || 0));

            const vinVal = Number(p.vin ?? p.v1 ?? v1);
            if (!Number.isNaN(vinVal) && vinVal !== 0) setVin(vinVal);

            const btn = p.btn ?? {};
            const parseBool = (x: any) => x === true || x === 'true' || x === 1 || x === '1';
            const b1 = parseBool(btn.b1 ?? btn[0]);
            const b2 = parseBool(btn.b2 ?? btn[1]);
            setSwitchStates([b1, b2]);
          }

          else if (row.type === 'command') {
            const cmd = p.cmd ?? p.command ?? null;
            const cmdPayload = p.payload ?? p.data ?? {};
            if (cmd === 'set_iot_led' && cmdPayload && (cmdPayload.index !== undefined)) {
              const idx = Number(cmdPayload.index) || 0;
              const state = cmdPayload.state === true || cmdPayload.state === 'true' || cmdPayload.state === 1 || cmdPayload.state === '1';
              setIotLeds((arr) => arr.map((v, i) => (i === idx ? state : v)));
            }
            if (cmd === 'set_board_led' && cmdPayload && (cmdPayload.index !== undefined)) {
              const idx = Number(cmdPayload.index) || 0;
              const state = cmdPayload.state === true || cmdPayload.state === 'true' || cmdPayload.state === 1 || cmdPayload.state === '1';
              setLedArray((arr) => arr.map((v, i) => (i === idx ? state : v)));
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Subscribe to realtime inserts
    const unsub = subscribeTelemetry((row: any) => {
      if (!isMounted) return;
      handleTelemetryRow(row);
    });

    // Poll latest telemetry every 500ms to ensure dashboard stays up-to-date
    const poll = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('telemetry')
          .select('*')
          .order('id', { ascending: false })
          .limit(1);
        if (error) return;
        if (data && data.length) {
          const row = data[0];
          if (row && row.id && row.id > lastSeenId) {
            handleTelemetryRow(row);
          } else if (row) {
            // still update heartbeat timestamp if same id appears (ensure connected state accurate)
            try {
              const ts = row.created_at ? Date.parse(row.created_at) : Date.now();
              setLastTelemetryAt(ts);
            } catch (e) {
              setLastTelemetryAt(Date.now());
            }
          }
        }
        // Also poll the device_status table (single-row per device). Prefer last_seen if available.
        try {
          const { data: ds, error: dserr } = await supabase
            .from('device_status')
            .select('last_seen')
            .order('last_seen', { ascending: false })
            .limit(1);
          if (!dserr && ds && ds.length) {
            const row = ds[0] as any;
            if (row && row.last_seen) {
              try {
                const ts = Date.parse(row.last_seen);
                setLastTelemetryAt(ts);
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        } catch (e) {
          // ignore device_status polling errors
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 500);

    // Ticker to update `connected` state from lastTelemetryAt
    const connTicker = setInterval(() => {
      if (!isMounted) return;
      if (!lastTelemetryAt) {
        setConnected(false);
        return;
      }
      const age = Date.now() - lastTelemetryAt;
      // consider connected if we've received telemetry within the last 3.5s
      setConnected(age < 3500);
    }, 500);

    return () => {
      isMounted = false;
      if (wsRef.current) wsRef.current.close();
      if (unsub) unsub();
      clearInterval(poll);
      clearInterval(connTicker);
    };
  }, []);

  function pushLog(item: string) {
    setLog((l) => [...l.slice(-199), item]);
  }

  function formatTimeAgo(ts: number | null) {
    if (!ts) return '—';
    const age = Math.max(0, Date.now() - ts);
    const sec = Math.floor(age / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec} sec${sec === 1 ? '' : 's'} ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'} ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? '' : 's'} ago`;
  }

  // Websocket helpers left available if needed, but dashboard determines
  // connection from telemetry heartbeat (lastTelemetryAt) rather than manual
  // connect/disconnect controls.

  function sendCmd(cmd: object) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      pushLog("Not connected");
      return;
    }
    wsRef.current.send(JSON.stringify(cmd));
    pushLog("TX: " + JSON.stringify(cmd));
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Device Dashboard</h1>
        <p className="text-sm text-muted-foreground">Control and view sensors for your connected devices.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-lg shadow">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground mb-1">Connection</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 h-10 flex items-center">
                  <div className={`font-semibold ${connected ? 'text-green-500' : 'text-red-400'}`}>{connected ? 'Connected' : 'Disconnected'}</div>
                  <div className="ml-auto text-xs text-muted-foreground">Last seen: {formatTimeAgo(lastTelemetryAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Placeholder controls for 8 red LEDs */}
          <div className="bg-card p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Board LED Controls</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {ledArray.map((isOn, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <button
                    className={`h-10 w-20 rounded font-semibold shadow border transition mb-2 ${isOn
                      ? 'bg-red-600 text-white border-red-700'
                      : 'bg-black text-white border-white hover:bg-gray-900'}`}
                    onClick={async () => {
                      const newState = !isOn;
                      // optimistic UI update
                      setLedArray(arr => arr.map((v, i) => i === idx ? newState : v));
                      try {
                        const res = await sendCommand('set_board_led', { index: idx, state: newState });
                        pushLog('Sent Supabase command: ' + JSON.stringify({ index: idx, state: newState, res }));
                      } catch (e) {
                        pushLog('Supabase send error for board LED');
                      }
                    }}
                  >
                    LED {idx + 1}
                  </button>
                  <span className={`text-xs font-bold ${isOn ? 'text-red-600' : 'text-gray-500'}`}>{isOn ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
            {/* IoT LED Controls subsection */}
            <div className="border-t border-gray-700 pt-4 mt-4">
              <h4 className="font-semibold mb-2">IoT LED Controls</h4>
              <div className="grid grid-cols-4 gap-4">
                {iotLeds.map((isOn, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <button
                      className={`h-10 w-20 rounded font-semibold shadow border transition mb-2 ${isOn
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-black text-white border-white hover:bg-gray-900'}`}
                      onClick={async () => {
                        const newState = !isOn;
                        setIotLeds((arr) => arr.map((v, i) => (i === idx ? newState : v)));
                        try {
                          const res = await sendCommand('set_iot_led', { index: idx, state: newState });
                          pushLog('Sent Supabase command: ' + JSON.stringify({ index: idx, state: newState, res }));
                        } catch (e) {
                          pushLog('Supabase send error');
                        }
                      }}
                    >
                      LED {idx + 1}
                    </button>
                    <span className={`text-xs font-bold ${isOn ? 'text-red-600' : 'text-gray-500'}`}>{isOn ? 'ON' : 'OFF'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visual indicators for 2 push-button switches */}
          <div className="bg-card p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Switch Status (Push Buttons)</h3>
            <div className="flex gap-8">
              {switchStates.map((pressed, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className={`min-h-10 min-w-[100px] flex items-center justify-center rounded font-semibold shadow border mb-2 px-4 py-2 whitespace-nowrap ${pressed
                      ? 'bg-green-500 text-white border-green-700'
                      : 'bg-black text-white border-white'}`}
                  >
                    Switch {idx + 1}
                  </div>
                  <span className={`text-xs font-bold ${pressed ? 'text-green-600' : 'text-gray-500'}`}>{pressed ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
          </div>

          

          {/* Display for Voltage In and 4 sensor values */}
          <div className="bg-card p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Voltage & Sensor Values</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4">
                <span className="font-bold">Voltage In (Vin):</span>
                <span className="px-3 py-1 rounded bg-black text-white border border-white">{vin.toFixed(2)} V</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {sensorValues.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-bold">Sensor {idx + 1}:</span>
                    <span className="px-3 py-1 rounded bg-black text-white border border-white">{val.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card p-4 rounded-lg shadow">
            <h3 className="font-semibold">Event Log</h3>
            <pre className="mt-2 max-h-80 overflow-auto bg-surface p-2 rounded text-xs">{log.join('\n')}</pre>
          </div>
        </div>

        
      </div>
    </div>
  );
};

export default Dev;
