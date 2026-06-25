/**
 * generateReceivingLogPDF — Daily receiving log PDF report
 *
 * Renders a DailyReceivingLog as a printable report:
 *   - Header (company + report title)
 *   - Long-form date + summary line
 *   - Entries summary table (vendor, PO, time, items, units)
 *   - Per-entry detail tables (line items: name, part#, action, before/received/after)
 *   - Footer with timestamp + page numbers
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DailyReceivingLog, ReceivingEntryWithItems } from '../features/receiving/types'

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function actionLabel(action: string): string {
  switch (action) {
    case 'update':
      return 'Updated'
    case 'create':
      return 'Created'
    case 'skip':
      return 'Skipped'
    case 'pending':
      return 'Pending'
    default:
      return action
  }
}

interface Stats {
  unitsReceived: number
  lineItemsActive: number
  lineItemsSkipped: number
  updated: number
  created: number
  vendorCount: number
  destinationCount: number
}

function computeStats(entries: ReceivingEntryWithItems[]): Stats {
  let unitsReceived = 0
  let lineItemsActive = 0
  let lineItemsSkipped = 0
  let updated = 0
  let created = 0
  const vendors = new Set<string>()
  const destinations = new Set<string>()

  for (const entry of entries) {
    vendors.add(entry.vendor)
    for (const item of entry.items) {
      if (item.action === 'skip') {
        lineItemsSkipped += 1
        continue
      }
      lineItemsActive += 1
      unitsReceived += item.quantity_received
      if (item.action === 'update') updated += 1
      if (item.action === 'create') created += 1
      if (item.destination_folder_name) destinations.add(item.destination_folder_name)
    }
  }

  return {
    unitsReceived,
    lineItemsActive,
    lineItemsSkipped,
    updated,
    created,
    vendorCount: vendors.size,
    destinationCount: destinations.size,
  }
}

export function generateReceivingLogPDF(log: DailyReceivingLog): void {
  const doc = new jsPDF()
  const entries = log.entries
  const stats = computeStats(entries)

  // ── Header ────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('WITH PRIDE HVAC', 105, 20, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('Daily Receiving Log', 105, 27, { align: 'center' })
  doc.setTextColor(0, 0, 0)

  // ── Date + summary line ───────────────────────────
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(formatLongDate(log.date), 20, 42)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const summaryLine = entries.length === 0
    ? 'No receipts logged for this day.'
    : `${entries.length} receipt${entries.length !== 1 ? 's' : ''} · ${stats.vendorCount} vendor${stats.vendorCount !== 1 ? 's' : ''} · ${stats.destinationCount} destination${stats.destinationCount !== 1 ? 's' : ''}`
  doc.text(summaryLine, 20, 49)
  doc.setTextColor(0, 0, 0)

  // ── Stats card ────────────────────────────────────
  if (entries.length > 0) {
    const statsY = 56
    doc.setDrawColor(220, 220, 220)
    doc.setFillColor(248, 249, 251)
    doc.roundedRect(20, statsY, 170, 22, 2, 2, 'FD')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('UNITS RECEIVED', 26, statsY + 6)
    doc.text('LINE ITEMS', 71, statsY + 6)
    doc.text('VENDORS', 116, statsY + 6)
    doc.text('INVENTORY IMPACT', 146, statsY + 6)

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(196, 123, 26) // --signal
    doc.text(stats.unitsReceived.toLocaleString(), 26, statsY + 15)
    doc.setTextColor(0, 0, 0)
    doc.text(stats.lineItemsActive.toLocaleString(), 71, statsY + 15)
    doc.text(stats.vendorCount.toLocaleString(), 116, statsY + 15)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${stats.updated} updated · ${stats.created} created`, 146, statsY + 15)
  }

  // ── Entries summary table ─────────────────────────
  if (entries.length === 0) {
    doc.save(`Receiving-Log-${log.date}.pdf`)
    return
  }

  let yPos = 86
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Entries', 20, yPos)
  yPos += 2

  const summaryRows = entries.map((entry) => {
    const activeItems = entry.items.filter((i) => i.action !== 'skip')
    const units = activeItems.reduce((sum, i) => sum + i.quantity_received, 0)
    const destination =
      entry.project_name ?? (entry.destination_type === 'warehouse' ? 'Main Warehouse' : '—')
    return [
      formatTime(entry.created_at),
      entry.vendor,
      entry.po_number || '—',
      destination,
      String(activeItems.length),
      String(units),
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Time', 'Vendor', 'PO', 'Destination', 'Items', 'Units']],
    body: summaryRows,
    theme: 'striped',
    headStyles: { fillColor: [50, 50, 50], fontSize: 9, textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 20, right: 20 },
  })

  // ── Per-entry detail tables ───────────────────────
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.items.length === 0) continue

    let currentY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos
    if (currentY > 230) {
      doc.addPage()
      currentY = 20
    }

    const headerY = currentY + 12

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    const headerText = `${i + 1}. ${entry.vendor}${entry.po_number ? ` · PO ${entry.po_number}` : ''}`
    doc.text(headerText, 20, headerY)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(formatTime(entry.created_at), 190, headerY, { align: 'right' })
    doc.setTextColor(0, 0, 0)

    const detailRows = entry.items.map((item) => [
      item.item_name,
      item.part_number || '—',
      item.destination_folder_name || '—',
      actionLabel(item.action),
      item.sortly_quantity_before !== null ? String(item.sortly_quantity_before) : '—',
      `+${item.quantity_received}`,
      item.sortly_quantity_after !== null ? String(item.sortly_quantity_after) : '—',
    ])

    autoTable(doc, {
      startY: headerY + 3,
      head: [['Item', 'Part #', 'Destination', 'Action', 'Before', 'Received', 'After']],
      body: detailRows,
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], fontSize: 8, textColor: [0, 0, 0] },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [196, 123, 26] },
        6: { cellWidth: 18, halign: 'right' },
      },
      margin: { left: 25, right: 20 },
    })
  }

  // ── Footer ────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150, 150, 150)
    doc.text(`With Pride HVAC · Generated ${new Date().toLocaleString()}`, 20, 285)
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  doc.save(`Receiving-Log-${log.date}.pdf`)
}
