import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

import type { DisputeEvidence } from "@/lib/disputes/evidence";
import { ATTEND_STATUS_LABELS, REJECT_REASON_LABELS } from "@/lib/utils/labels";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#555", marginBottom: 2 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 12 },
  metaCol: { flexDirection: "column", gap: 2 },
  table: { display: "flex", flexDirection: "column", borderTop: "1px solid #ccc", marginTop: 8 },
  row: { flexDirection: "row", borderBottom: "1px solid #eee", paddingVertical: 4 },
  headerRow: { flexDirection: "row", borderBottom: "1px solid #333", paddingVertical: 4, fontWeight: 700 },
  cChild: { width: "22%" },
  cDate: { width: "12%" },
  cStatus: { width: "12%" },
  cReason: { width: "18%" },
  cNote: { width: "20%" },
  cHash: { width: "16%", fontSize: 7, color: "#666" },
  footer: { marginTop: 20, fontSize: 8, color: "#888" },
});

/**
 * The dispute evidence bundle handed to the state system (TZ §7.7): every
 * rejected `state_check` in the dispute, with what we recorded, when, by
 * whom, and the photo's SHA-256 as a tamper-evidence pointer (the photo
 * itself stays in private storage — a hash is proof without a leak).
 */
export function DisputeDocument({ evidence }: { evidence: DisputeEvidence }) {
  const { dispute, org, rows } = evidence;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{dispute.title}</Text>
        <Text style={styles.subtitle}>{org.name}</Text>
        {(org.region || org.district) && (
          <Text style={styles.subtitle}>{[org.region, org.district].filter(Boolean).join(", ")}</Text>
        )}

        <View style={styles.meta}>
          <View style={styles.metaCol}>
            <Text>Davr: {dispute.period_month}</Text>
            <Text>Bolalar soni: {dispute.affected_children}</Text>
            <Text>Kunlar soni: {dispute.affected_days}</Text>
          </View>
          <View style={styles.metaCol}>
            {dispute.estimated_amount != null && (
              <Text>Taxminiy summa: {dispute.estimated_amount.toLocaleString("uz-UZ")} so&apos;m</Text>
            )}
            <Text>Yaratildi: {new Date().toISOString().slice(0, 10)}</Text>
            {dispute.bundle_code && <Text>Kod: {dispute.bundle_code}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.cChild}>Bola</Text>
            <Text style={styles.cDate}>Sana</Text>
            <Text style={styles.cStatus}>Bizning belgi</Text>
            <Text style={styles.cReason}>Rad sababi</Text>
            <Text style={styles.cNote}>Izoh</Text>
            <Text style={styles.cHash}>Rasm hash (SHA-256)</Text>
          </View>
          {rows.map((r) => (
            <View style={styles.row} key={`${r.child_name}|${r.day_date}`}>
              <Text style={styles.cChild}>{r.child_name}</Text>
              <Text style={styles.cDate}>{r.day_date}</Text>
              <Text style={styles.cStatus}>{ATTEND_STATUS_LABELS[r.our_status] ?? r.our_status}</Text>
              <Text style={styles.cReason}>{r.reason ? (REJECT_REASON_LABELS[r.reason] ?? r.reason) : "-"}</Text>
              <Text style={styles.cNote}>{r.note ?? "-"}</Text>
              <Text style={styles.cHash}>{r.photo_sha256 ?? "rasmsiz"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Ushbu hujjat Qalqon tizimi tomonidan avtomatik yaratildi. Har bir yozuv serverda belgilangan vaqt
          va (mavjud bo&apos;lsa) rasmning SHA-256 xeshi bilan tasdiqlangan.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderDisputePdf(evidence: DisputeEvidence): Promise<Buffer> {
  return renderToBuffer(<DisputeDocument evidence={evidence} />);
}
