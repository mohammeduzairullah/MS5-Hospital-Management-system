import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
export function prescriptionPDF(record) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: "Careflow prescription",
        Author: "Evergreen Hospital demo",
      },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (existsSync("C:/Windows/Fonts/arial.ttf"))
      doc.font("C:/Windows/Fonts/arial.ttf");
    doc.fillColor("#147767").fontSize(23).text("careflow.");
    doc
      .fontSize(10)
      .fillColor("#567366")
      .text("EVERGREEN HOSPITAL | DEMO PRESCRIPTION");
    doc.moveDown(2);
    doc.fillColor("#223e3a").fontSize(18).text(record.patient.name);
    doc
      .fontSize(10)
      .text(
        `Date of birth: ${record.patient.dob}   |   Blood group: ${record.patient.bloodGroup}`,
      );
    doc.text(`Doctor: ${record.doctor.name} - ${record.doctor.specialty}`);
    doc.text(
      `Issued: ${new Date(record.createdAt).toLocaleDateString("en-GB")}`,
    );
    doc.moveDown();
    doc.fontSize(10).fillColor("#147767").text("DIAGNOSIS");
    doc.fillColor("#223e3a").fontSize(12).text(record.diagnosis);
    doc.moveDown();
    doc
      .fontSize(10)
      .table({
        columnStyles: [170, 100, 115, "*"],
        data: [
          ["Medicine", "Dosage", "Frequency", "Duration"],
          ...record.medications.map((m) => [
            m.name,
            m.dosage,
            m.frequency,
            m.duration,
          ]),
        ],
      });
    doc.moveDown(1.5);
    doc.fillColor("#147767").fontSize(10).text("INSTRUCTIONS / FOLLOW-UP");
    doc
      .fillColor("#223e3a")
      .fontSize(11)
      .text(record.notes || "No additional instructions.");
    doc.moveDown(2);
    doc
      .fillColor("#8b7568")
      .fontSize(9)
      .text("Fictional portfolio record. Not valid for dispensing medication.");
    doc.end();
  });
}
