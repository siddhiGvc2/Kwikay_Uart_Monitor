import { useState, useRef, useEffect } from "react";
import "./App.css";

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [reader, setReader] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("Disconnected");

  const terminalRef = useRef(null);

  // Auto-scroll terminal when new data comes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [uartData]);

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

      // Read loop
      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              setUartData((prev) => prev + decoder.decode(value));
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
      setUartData(""); // Clear terminal
      setStatus("Disconnected");
      console.log("✅ Disconnected from UART");
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  // Send message
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

        {/* Connection Status */}
        <p className={`status ${status === "Connected" ? "connected" : "disconnected"}`}>
          Status: {status}
        </p>

        {/* Connect / Disconnect Buttons */}
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

        {/* Send Section */}
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
            onClick={() => setUartData("")}
            className="btn clear"
            disabled={!uartData}
          >
            Clear Terminal
          </button>
        </div>

        {/* Terminal Output */}
        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal" ref={terminalRef}>
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
