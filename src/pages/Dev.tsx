import { useEffect, useRef, useState } from "react";

const Dev = () => {
    // Placeholder for Voltage In and 4 sensor values
    const [vin, setVin] = useState(12.0);
    const [sensorValues, setSensorValues] = useState([0.0, 0.0, 0.0, 0.0]);
  const [connected, setConnected] = useState(false);
  const [deviceId, setDeviceId] = useState("device-001");
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
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  function pushLog(item: string) {
    setLog((l) => [...l.slice(-199), item]);
  }

  function connect() {
    if (wsRef.current) return;
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/dev/ws";
    pushLog(`Connecting ${url}`);
    const ws = new WebSocket(url);
    ws.onopen = () => {
      pushLog("WS open");
      ws.send(JSON.stringify({ type: "identify", role: "dashboard", id: "web-" + (Math.random() * 1000 | 0) }));
      setConnected(true);
    };
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data as string);
        pushLog("RX: " + JSON.stringify(d));
        if (d.type === "event" && d.payload) {
          setLastSensor(String(d.payload));
        }
      } catch (e) {
        pushLog("RX (raw): " + String(ev.data));
      }
    };
    ws.onclose = () => {
      pushLog("WS closed");
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = (e) => pushLog("WS error");
    wsRef.current = ws;
  }

  function disconnect() {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="bg-card p-4 rounded-lg shadow">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-muted-foreground mb-1">Device ID</label>
              <div className="flex items-center gap-2">
                <input className="flex-1 input bg-card text-foreground border border-white rounded px-3 py-2 h-10" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} />
                <button className="h-10 px-4 rounded bg-white text-gray-800 font-semibold shadow border border-gray-300 hover:bg-gray-100 transition" onClick={connect} disabled={connected}>Connect</button>
                <button className="h-10 px-4 rounded bg-black text-white font-semibold shadow border border-white hover:bg-gray-900 transition" onClick={disconnect} disabled={!connected}>Disconnect</button>
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
                    onClick={() => setLedArray(arr => arr.map((v, i) => i === idx ? !v : v))}
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
                      onClick={() => setIotLeds(arr => arr.map((v, i) => i === idx ? !v : v))}
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

        <aside className="space-y-4">
          <div className="bg-card p-4 rounded-lg shadow">
            <div className="text-sm text-muted-foreground">Connection</div>
            <div className="font-medium">{connected ? 'Connected' : 'Disconnected'}</div>
          </div>

          <div className="bg-card p-4 rounded-lg shadow">
            <div className="text-sm text-muted-foreground">Last Sensor</div>
            <div className="font-medium">{lastSensor ?? '—'}</div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Dev;
