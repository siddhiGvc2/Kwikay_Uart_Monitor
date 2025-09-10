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
    hbt_counter:0,
    hbt_timer:0,
    wifi_errors:0,
    tcp_errors:0,
    mqtt_errors:0
  });

  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [uartData]);

  // Parse terminal data into device info
  const parseDeviceInfo = (data) => {
    console.log(data);
  const info = { macId: "", fwVersion: "", serialNumber: "", ssid: "" };

 if (data.startsWith("*MAC:")) {
      console.log(data);
      // Remove *MAC: and any leading/trailing spaces
      const macLine = data.replace("*MAC:", "").trim();

      // Split by ':' — last part is Serial Number
      const parts = macLine.split(":");
      if (parts.length >= 7) {
        info.macId = parts.slice(0, 6).join(":");      // D4:8A:FC:C3:F0:34
        info.serialNumber = parts[6].replace(/#$/, "");                  // 999999
      }
    }  else if (data.startsWith("*FW:")) {
    let fwLine = data.replace("*FW:", "").trim();
    if (fwLine.startsWith("*")) fwLine = fwLine.substring(1); // remove leading *
    info.fwVersion = fwLine.split(" ")[0]; // take first word as version
  } else if (data.startsWith("*SSID")) {
      console.log(data);
      // Remove leading *SSID, and split by ','
      const ssidParts = data.replace("*SSID,", "").split(",");
      // Take elements from index 3 onward as actual SSIDs
      const ssids = ssidParts.slice(2).filter(Boolean); 
      info.ssid = ssids.join(", ").replace(/#$/, ""); // Join multiple SSIDs
    }
    else if(data.startsWith("*HBT-")){
      console.log(data);
      setDeviceInfo((prev) => ({
        ...prev,
        hbt_counter: (prev.hbt_counter || 0) + 1,
        hbt_timer: 0,
      }));
       
    }
    else if(data.startsWith("*TCP-NOTOK#")){
      setDeviceInfo((prev) => ({
        ...prev,
        tcp_errors: (prev.tcp_errors || 0) + 1,
      }));
    }


  // Update only non-empty values
  setDeviceInfo((prev) => ({
    macId: info.macId || prev.macId,
    serialNumber: info.serialNumber || prev.serialNumber,
    fwVersion: info.fwVersion || prev.fwVersion,
    ssid: info.ssid || prev.ssid,
    hbt_counter:info.hbt_counter || prev.hbt_counter,
    hbt_timer:info.hbt_timer || prev.hbt_timer,
    wifi_erros:info.wifi_erros || prev.wifi_errors,
    tcp_errors:info.tcp_errors || prev.tcp_errors,
    mqtt_errors:info.mqtt_errors || prev.mqtt_errors
    

  }));
};


useEffect(()=>{
  let Interval;
  if(status=="Connected")
  {
    Interval=setInterval(()=>{
     setDeviceInfo((prev) => ({
        ...prev,
        hbt_timer: (prev.hbt_timer || 0) + 1,
      }));
  },1000);
  }
  else{
     clearInterval(Interval);
  }

},[status]);

let uartBuffer = "";


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

    // 🟢 Automatically send *RST# every time we connect/reconnect
    await writer.write(new TextEncoder().encode("*RST#\n"));
    setTimeout(async()=>{
      await writer.write(new TextEncoder().encode("*SSID?#\n"));
    },5000)

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

        uartBuffer += text;

        // ✅ Extract only complete messages like "*...#"
        const regex = /\*[^#]*#/g;
        let match;
        while ((match = regex.exec(uartBuffer)) !== null) {
          const line = match[0].trim(); // full message, e.g. "*HBT-S#"
          parseDeviceInfo(line);        // send to parser
        }

        // Keep only the leftover (after last #)
        const lastHash = uartBuffer.lastIndexOf("#");
        if (lastHash >= 0) {
          uartBuffer = uartBuffer.slice(lastHash + 1);
        }
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
            <strong>ID:</strong> {deviceInfo.macId || "-"} / {deviceInfo.serialNumber || "-"} / {deviceInfo.fwVersion || "-"}
          </div>
          <div className="info-card">
            <strong>SSID:</strong> {deviceInfo.ssid || "-"}
          </div>
           <div className="info-card">
             <strong>HBT-S:</strong>  {deviceInfo.hbt_counter} / {deviceInfo.hbt_timer}
           </div>
              <div className="info-card">
             <strong>WIFI-ERRORS:</strong> {deviceInfo.wifi_errors}
           </div>
            <div className="info-card">
             <strong>TCP-ERRORS:</strong> {deviceInfo.tcp_errors}
           </div>
            <div className="info-card">
             <strong>MQTT-ERRORS:</strong> {deviceInfo.mqtt_errors}
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
