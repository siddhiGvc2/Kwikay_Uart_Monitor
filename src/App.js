import { useState, useRef, useEffect } from "react";
import "./App.css";

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [reader, setReader] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("Disconnected");

  // Parsed device info
  const [deviceInfo, setDeviceInfo] = useState({
    macId: "",
    fwVersion: "",
    serialNumber: "",
    ssid: "",
  });

  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [uartData]);

  // Parse terminal data into device info
  const parseDeviceInfo = (data) => {
    const lines = data.split(/\r?\n/);
    const info = { macId: "", fwVersion: "", serialNumber: "", ssid: "" };

    lines.forEach((line) => {
      if (line.startsWith("MAC:")) info.macId = line.split("MAC:")[1].trim();
      else if (line.startsWith("FW:")) info.fwVersion = line.split("FW:")[1].trim();
      else if (line.startsWith("Serial:")) info.serialNumber = line.split("Serial:")[1].trim();
      else if (line.startsWith("SSID:")) info.ssid = line.split("SSID:")[1].trim();
    });

    setDeviceInfo(info);
  };

  // Connect to UART
  const connectSerial = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      setPort(selectedPort);
      setStatus("Connected");

      // Setup writer
      const writer = selectedPort.writable.getWriter();
      setWriter(writer);

      // Setup reader
      const reader = selectedPort.readable.getReader();
      setReader(reader);

      const decoder = new TextDecoder();

      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const text = decoder.decode(value);
              setUartData((prev) => prev + text);
              parseDeviceInfo(text); // Parse each incoming chunk
            }
          }
        } catch (err) {
          console.error("Read loop stopped:", err);
        } finally {
          reader.releaseLock();
        }
      };

      readLoop();
    } catch (err) {
      console.error("Error connecting to UART:", err);
      setStatus("Error");
    }
  };

  // Disconnect UART
  const disconnectSerial = async () => {
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
        setReader(null);
      }
      if (writer) {
        writer.releaseLock();
        setWriter(null);
      }
      if (port) {
        await port.close();
        setPort(null);
      }
      setUartData("");
      setDeviceInfo({ macId: "", fwVersion: "", serialNumber: "", ssid: "" });
      setStatus("Disconnected");
      console.log("✅ Disconnected and cleared data");
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  const sendSerial = async () => {
    if (!writer || !msg) return;
    try {
      await writer.write(new TextEncoder().encode(msg + "\n"));
      setMsg("");
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">UART Dashboard</h1>

        {/* Status */}
        <p className={`status ${status === "Connected" ? "connected" : "disconnected"}`}>
          Status: {status}
        </p>

        {/* Connect / Disconnect */}
        {!port ? (
          <div className="center">
            <button onClick={connectSerial} className="btn connect">
              Connect UART
            </button>
          </div>
        ) : (
          <div className="center">
            <button onClick={disconnectSerial} className="btn disconnect">
              Disconnect
            </button>
          </div>
        )}

        {/* Send */}
        <div className="send-section">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Enter UART command"
            className="input"
          />
          <button onClick={sendSerial} className="btn send" disabled={!writer || !msg}>
            Send
          </button>
          <button
            onClick={() => {
              setUartData("");
              setDeviceInfo({ macId: "", fwVersion: "", serialNumber: "", ssid: "" });
            }}
            className="btn clear"
            disabled={!uartData}
          >
            Clear Terminal
          </button>
        </div>

        {/* Device Info Cards */}
        <div className="info-cards">
          <div className="info-card">
            <strong>MAC ID:</strong> {deviceInfo.macId || "-"}
          </div>
          <div className="info-card">
            <strong>FW Version:</strong> {deviceInfo.fwVersion || "-"}
          </div>
          <div className="info-card">
            <strong>Serial Number:</strong> {deviceInfo.serialNumber || "-"}
          </div>
          <div className="info-card">
            <strong>SSID:</strong> {deviceInfo.ssid || "-"}
          </div>
        </div>

        {/* Terminal */}
        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal" ref={terminalRef}>
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
