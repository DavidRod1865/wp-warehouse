import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Address } from "../types/address";

interface DeliveryItem {
  item_name: string;
  quantity: number;
  notes: string | null;
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }> | null;
}

interface DeliveryData {
  delivery_number: string;
  project_name: string | null;
  truck_name: string | null;
  from_address: Address;
  to_address: Address;
  status: string;
  created_at: string;
  items: DeliveryItem[];
}

export function generateDeliveryPDF(delivery: DeliveryData): void {
  const doc = new jsPDF();

  // Company Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("WITH PRIDE HVAC", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Delivery Order", 105, 28, { align: "center" });

  // Delivery Number (Large and prominent)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Delivery #: ${delivery.delivery_number}`, 20, 45);

  // Status Badge
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const statusText = delivery.status.toUpperCase();
  const statusColor =
    delivery.status === "pending"
      ? [255, 235, 59]
      : delivery.status === "delivered"
      ? [76, 175, 80]
      : [158, 158, 158];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(150, 40, 40, 8, "F");
  doc.text(statusText, 170, 45, { align: "center" });

  // Delivery Information
  let yPos = 60;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Delivery Information", 20, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Two columns layout
  const leftCol = 20;
  const rightCol = 110;

  // Left column
  doc.setFont("helvetica", "bold");
  doc.text("Project:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(
    delivery.project_name || "No Project (Residential)",
    leftCol + 25,
    yPos
  );

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Truck:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(delivery.truck_name || "-", leftCol + 25, yPos);

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Created:", leftCol, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(delivery.created_at).toLocaleString(), leftCol + 25, yPos);

  // Reset yPos for right column
  yPos = 68;

  // From Address
  doc.setFont("helvetica", "bold");
  doc.text("From:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;
  doc.text(delivery.from_address.company_name, rightCol, yPos);
  yPos += 5;
  doc.text(delivery.from_address.street_address, rightCol, yPos);
  yPos += 5;
  doc.text(
    `${delivery.from_address.city}, ${delivery.from_address.state} ${delivery.from_address.zip_code}`,
    rightCol,
    yPos
  );
  yPos += 5;
  doc.text(`Tel: ${delivery.from_address.phone}`, rightCol, yPos);
  yPos += 5;

  // To Address
  doc.setFont("helvetica", "bold");
  doc.text("To:", rightCol, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 5;
  doc.text(delivery.to_address.company_name, rightCol, yPos);
  yPos += 5;
  doc.text(delivery.to_address.street_address, rightCol, yPos);
  yPos += 5;
  doc.text(
    `${delivery.to_address.city}, ${delivery.to_address.state} ${delivery.to_address.zip_code}`,
    rightCol,
    yPos
  );
  yPos += 5;
  doc.text(`Tel: ${delivery.to_address.phone}`, rightCol, yPos);

  // Items Table
  yPos = 110;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Items", 20, yPos);

  yPos += 5;

  // Prepare table data
  const tableData = delivery.items.map((item) => {
    const brand =
      item.custom_attribute_values?.find(
        (a) => a.custom_attribute_name.toLowerCase() === "brand"
      )?.value || "-";
    const partNumber =
      item.custom_attribute_values?.find(
        (a) => a.custom_attribute_name.toLowerCase() === "part number"
      )?.value || "-";

    return [
      item.item_name,
      brand,
      partNumber,
      item.quantity.toString(),
      item.notes || "-",
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [["Item Name", "Brand", "Part #", "Qty", "Location"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 40 },
    },
  });

  // Signature Section
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 50;
  const signatureY = finalY + 20;

  if (signatureY + 40 < 280) {
    // Make sure there's room
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Signatures", 20, signatureY);

    // Driver signature
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.line(20, signatureY + 20, 90, signatureY + 20);
    doc.text("Driver Signature", 20, signatureY + 25);
    doc.text("Date: _______________", 20, signatureY + 32);

    // Receiver signature
    doc.line(110, signatureY + 20, 180, signatureY + 20);
    doc.text("Receiver Signature", 110, signatureY + 25);
    doc.text("Date: _______________", 110, signatureY + 32);
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("With Pride HVAC - Delivery Order", 105, 285, { align: "center" });
  doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 290, {
    align: "center",
  });

  // Save the PDF
  doc.save(`${delivery.delivery_number}.pdf`);
}
