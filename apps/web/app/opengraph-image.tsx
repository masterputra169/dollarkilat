import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "dollarkilat — Earned in dollars, spend in rupiah. Pay any QRIS code in Indonesia directly from your USDC balance.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(1100px 600px at 15% 10%, rgba(120, 90, 255, 0.35) 0%, rgba(9, 9, 11, 0) 60%), radial-gradient(900px 500px at 90% 100%, rgba(255, 153, 102, 0.28) 0%, rgba(9, 9, 11, 0) 55%), linear-gradient(180deg, #09090b 0%, #0b0a14 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background:
                "linear-gradient(135deg, #a78bfa 0%, #f0abfc 50%, #fb923c 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: 800,
              color: "#09090b",
              letterSpacing: "-0.05em",
            }}
          >
            $
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#fafafa",
            }}
          >
            dollarkilat
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "92px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              backgroundImage:
                "linear-gradient(110deg, #ffffff 0%, #c4b5fd 45%, #fdba74 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Earned in dollars,
            <br />
            spend in rupiah.
          </div>
          <div
            style={{
              fontSize: "30px",
              fontWeight: 400,
              color: "#a1a1aa",
              maxWidth: "880px",
              lineHeight: 1.35,
            }}
          >
            Pay any QRIS code straight from your USDC balance. Built for
            Indonesian freelancers, creators, and remote workers.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "22px",
            color: "#71717a",
          }}
        >
          <div style={{ display: "flex", gap: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: "#a78bfa",
                }}
              />
              Instant QRIS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: "#f0abfc",
                }}
              />
              Non-custodial
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "999px",
                  background: "#fb923c",
                }}
              />
              Built on Solana
            </div>
          </div>
          <div style={{ fontWeight: 500, color: "#a1a1aa" }}>
            dollarkilat.xyz
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
