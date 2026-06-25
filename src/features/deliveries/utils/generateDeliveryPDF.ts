/**
 * generateDeliveryPDF.ts — PDF generation for delivery orders
 *
 * Uses jsPDF + jspdf-autotable to produce a printable delivery document with:
 * - Company header, delivery number, status badge
 * - From/To addresses in two-column layout
 * - Items table with brand, part #, quantity
 * - Signature section (blank lines or captured signature image)
 * - Delivery photos (up to 8, in 2x2 grid)
 * - Paginated footer
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Address } from '../../../types/address'

interface PDFDeliveryItem {
  item_name: string
  quantity: number
  notes: string | null
  custom_attribute_values?: Array<{
    custom_attribute_id: number
    custom_attribute_name: string
    value: string
  }> | null
}

interface PDFDeliveryPhoto {
  id: string
  photo_url: string
  photo_type: string | null
  notes: string | null
  uploaded_at: string
}

interface PDFDeliveryData {
  delivery_number: string
  project_name: string | null
  truck_name: string | null
  from_address: Address
  to_address: Address
  status: string
  created_at: string
  items: PDFDeliveryItem[]
  photos?: PDFDeliveryPhoto[]
  signature_name?: string | null
  signature_data?: string | null
}

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg'))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pending: [255, 235, 59],
  delivered: [76, 175, 80],
  partial: [255, 152, 0],
  in_transit: [33, 150, 243],
}
const DEFAULT_STATUS_COLOR: [number, number, number] = [158, 158, 158]

export async function generateDeliveryPDF(delivery: PDFDeliveryData): Promise<void> {
  const doc = new jsPDF()

  // ── Company Header ──
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('WITH PRIDE HVAC', 105, 20, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Delivery Order', 105, 28, { align: 'center' })

  // ── Delivery Number + Status ──
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Delivery #: ${delivery.delivery_number}`, 20, 45)

  const statusColor = STATUS_COLORS[delivery.status] ?? DEFAULT_STATUS_COLOR
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.rect(150, 40, 40, 8, 'F')
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(delivery.status.toUpperCase(), 170, 45, { align: 'center' })

  // ── Delivery Info (left column) ──
  let yPos = 60
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Delivery Information', 20, yPos)

  yPos += 8
  doc.setFontSize(10)
  const leftCol = 20
  const rightCol = 110

  doc.setFont('helvetica', 'bold')
  doc.text('Project:', leftCol, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(delivery.project_name || 'No Project (Residential)', leftCol + 25, yPos)

  yPos += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Truck:', leftCol, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(delivery.truck_name || '-', leftCol + 25, yPos)

  yPos += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Created:', leftCol, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(new Date(delivery.created_at).toLocaleString(), leftCol + 25, yPos)

  // ── Addresses (right column) ──
  yPos = 68
  const renderAddress = (label: string, addr: Address, startY: number) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, rightCol, startY)
    doc.setFont('helvetica', 'normal')
    let y = startY + 5
    doc.text(addr.company_name, rightCol, y); y += 5
    doc.text(addr.street_address, rightCol, y); y += 5
    doc.text(`${addr.city}, ${addr.state} ${addr.zip_code}`, rightCol, y); y += 5
    doc.text(`Tel: ${addr.phone}`, rightCol, y); y += 5
    return y
  }

  yPos = renderAddress('From', delivery.from_address, yPos)
  yPos += 2
  renderAddress('To', delivery.to_address, yPos)

  // ── Items Table ──
  yPos = 110
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Items', 20, yPos)
  yPos += 5

  const tableData = delivery.items.map((item) => {
    const brand = item.custom_attribute_values?.find(
      (a) => a.custom_attribute_name.toLowerCase() === 'brand'
    )?.value || '-'
    const partNumber = item.custom_attribute_values?.find(
      (a) => a.custom_attribute_name.toLowerCase() === 'part number'
    )?.value || '-'

    return [item.item_name, brand, partNumber, item.quantity.toString(), item.notes || '-']
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Item Name', 'Brand', 'Part #', 'Qty', 'Location']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 40 },
    },
  })

  // ── Signature Section ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTableInfo = (doc as any).lastAutoTable as { finalY: number } | undefined
  let currentY = autoTableInfo ? autoTableInfo.finalY : yPos + 50
  let signatureY = currentY + 20

  if (signatureY + 50 > 270) {
    doc.addPage()
    signatureY = 20
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Signatures', 20, signatureY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  if (delivery.signature_data) {
    try {
      doc.addImage(delivery.signature_data, 'PNG', 20, signatureY + 5, 80, 30)
      doc.text(`Signed by: ${delivery.signature_name || 'Unknown'}`, 20, signatureY + 40)
    } catch {
      doc.line(20, signatureY + 20, 90, signatureY + 20)
      doc.text('Receiver Signature', 20, signatureY + 25)
    }
  } else {
    doc.line(20, signatureY + 20, 90, signatureY + 20)
    doc.text('Driver Signature', 20, signatureY + 25)
    doc.text('Date: _______________', 20, signatureY + 32)
    doc.line(110, signatureY + 20, 180, signatureY + 20)
    doc.text('Receiver Signature', 110, signatureY + 25)
    doc.text('Date: _______________', 110, signatureY + 32)
  }

  currentY = signatureY + 45

  // ── Photos ──
  if (delivery.photos && delivery.photos.length > 0) {
    if (currentY + 60 > 270) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Delivery Photos', 20, currentY)
    currentY += 10

    const photosToInclude = delivery.photos.slice(0, 8)
    let photoIndex = 0

    for (const photo of photosToInclude) {
      try {
        if (photoIndex > 0 && photoIndex % 4 === 0) {
          doc.addPage()
          currentY = 20
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text('Delivery Photos (continued)', 20, currentY)
          currentY += 10
        }

        const photoData = await loadImageAsBase64(photo.photo_url)
        const col = photoIndex % 2
        const row = Math.floor((photoIndex % 4) / 2)
        const x = 20 + col * 95
        const y = currentY + row * 65

        doc.addImage(photoData, 'JPEG', x, y, 85, 50)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        const caption = photo.photo_type
          ? photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)
          : 'Photo'
        doc.text(caption, x, y + 53)
        if (photo.notes) doc.text(photo.notes.substring(0, 30), x, y + 57)

        photoIndex++
      } catch {
        // Skip failed photo
      }
    }
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('With Pride HVAC - Delivery Order', 105, 285, { align: 'center' })
    doc.text(
      `Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  doc.save(`${delivery.delivery_number}.pdf`)
}
