import { useState } from "react";
import "./App.css"; // Import the CSS file

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");

  // Connect to UART
  const connectSerial = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      setPort(selectedPort);

      // Setup writer for sending
      const writer = selectedPort.writable.getWriter();
      setWriter(writer);

      // Setup reader for receiving
      const reader = selectedPort.readable.getReader();
      const decoder = new TextDecoder();

      const readLoop = async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            setUartData((prev) => prev + decoder.decode(value));
          }
        }
      };

      readLoop();
    } catch (err) {
      console.error("Error connecting to UART:", err);
    }
  };

  // Send message to UART
  const sendSerial = async () => {
    if (!writer) return;
    await writer.write(new TextEncoder().encode(msg + "\n"));
    setMsg("");
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">UART Dashboard</h1>

        {!port && (
          <div className="center">
            <button onClick={connectSerial} className="btn connect">
              Connect UART
            </button>
          </div>
        )}

        <div className="send-section">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Enter UART command"
            className="input"
          />
          <button onClick={sendSerial} className="btn send">
            Send
          </button>
        </div>

        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal">
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
