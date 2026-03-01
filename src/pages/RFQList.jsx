import { useEffect, useState } from "react";
import api from "../api/axios";

function RFQList() {
  const [rfqs, setRfqs] = useState([]);

  useEffect(() => {
    const fetchRFQ = async () => {
      const res = await api.get("/rfq");
      setRfqs(res.data.data);
    };

    fetchRFQ();
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h1>📦 Açık Talepler</h1>

      {rfqs.map((rfq) => (
        <div
          key={rfq._id}
          style={{
            border: "1px solid #ddd",
            padding: "20px",
            marginTop: "20px",
            borderRadius: "10px"
          }}
        >
          <h3>{rfq.title}</h3>
          <p>{rfq.description}</p>
          <p>Adet: {rfq.quantity}</p>
          <p>Kategori: {rfq.category}</p>
        </div>
      ))}
    </div>
  );
}

export default RFQList;
