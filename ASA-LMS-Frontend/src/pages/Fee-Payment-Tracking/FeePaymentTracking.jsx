import React, { useState } from 'react';
import './FeePaymentTracking.css';
import { Upload, Download, Search, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';

const FeePaymentTracking = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const [ledgerData] = useState([
    {
      id: 1,
      studentName: 'Aarav Sharma',
      paymentMethod: 'via UPI',
      batch: 'AAP-04A',
      amount: '₹ 24,000',
      paidAmount: '₹ 24,000',
      dueDate: 'Jun 30',
      status: 'PAID',
    },
    {
      id: 2,
      studentName: 'Meera Nair',
      paymentMethod: 'via Bank',
      batch: 'AAP-04A',
      amount: '₹ 24,000',
      paidAmount: '₹ 12,000',
      dueDate: 'Jun 30',
      status: 'PARTIAL',
    },
    {
      id: 3,
      studentName: 'Ishaan Rao',
      paymentMethod: '',
      batch: 'AAP-04B',
      amount: '₹ 24,000',
      paidAmount: '₹ 0',
      dueDate: 'Jul 05',
      status: 'OVERDUE',
    },
    {
      id: 4,
      studentName: 'Kavya Reddy',
      paymentMethod: 'via Card',
      batch: 'AAP-04C',
      amount: '₹ 24,000',
      paidAmount: '₹ 24,000',
      dueDate: 'Jun 30',
      status: 'PAID',
    },
    {
      id: 5,
      studentName: 'Rohan Gupta',
      paymentMethod: '',
      batch: 'AAP-04D',
      amount: '₹ 24,000',
      paidAmount: '₹ 0',
      dueDate: 'Jul 15',
      status: 'PENDING',
    },
    {
      id: 6,
      studentName: 'Diya Patel',
      paymentMethod: 'via UPI',
      batch: 'AAP-04C',
      amount: '₹ 24,000',
      paidAmount: '₹ 24,000',
      dueDate: 'Jun 30',
      status: 'PAID',
    },
    {
      id: 7,
      studentName: 'Vihaan Bose',
      paymentMethod: 'via UPI',
      batch: 'AAP-04B',
      amount: '₹ 24,000',
      paidAmount: '₹ 6,000',
      dueDate: 'Jul 01',
      status: 'PARTIAL',
    },
    {
      id: 8,
      studentName: 'Anika Menon',
      paymentMethod: 'via Bank',
      batch: 'AAP-04D',
      amount: '₹ 24,000',
      paidAmount: '₹ 24,000',
      dueDate: 'Jun 30',
      status: 'PAID',
    },
  ]);

  const filteredLedger = ledgerData.filter(
    (item) =>
      item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batch.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSyncExcel = () => {
    toast.success('Successfully synced with linked Excel sheet!');
  };

  const handleExport = () => {
    toast.success('Exported fee ledger report successfully.');
  };

  return (
    <div className="fpt-container">
      {/* Header Section */}
      <div className="fpt-header-section">
        <div className="fpt-breadcrumb">FINANCE</div>
        <div className="fpt-title-row">
          <div className="fpt-title-left">
            <h1 className="fpt-title">Fee Payment Tracking</h1>
            <p className="fpt-subtitle">
              Track fees paid, pending and overdue. Synced with the linked Excel sheet.
            </p>
          </div>
          <div className="fpt-title-actions">
            <button className="fpt-btn-sync" onClick={handleSyncExcel}>
              <Upload size={16} /> Sync Excel
            </button>
            <button className="fpt-btn-export" onClick={handleExport}>
              <Download size={16} /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="fpt-metrics-row">
        <div className="fpt-metric-card">
          <span className="fpt-metric-label">COLLECTED</span>
          <span className="fpt-metric-value collected">₹14.20L</span>
        </div>
        <div className="fpt-metric-card">
          <span className="fpt-metric-label">PENDING</span>
          <span className="fpt-metric-value pending">₹2.75L</span>
        </div>
        <div className="fpt-metric-card">
          <div className="fpt-excel-label-group">
            <FileSpreadsheet size={15} className="fpt-excel-icon" />
            <span className="fpt-metric-label">EXCEL LINK</span>
          </div>
          <span className="fpt-metric-value connected">Connected</span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="fpt-search-bar">
        <Search size={16} className="fpt-search-icon" />
        <input
          type="text"
          className="fpt-search-input"
          placeholder="Search student or batch..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Ledger Table Container */}
      <div className="fpt-ledger-panel">
        <h2 className="fpt-panel-title">Ledger</h2>
        <div className="fpt-table-container">
          <table className="fpt-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>BATCH</th>
                <th>AMOUNT</th>
                <th>PAID DUE</th>
                <th className="text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="fpt-student-cell">
                      <span className="fpt-student-name">{row.studentName}</span>
                      {row.paymentMethod && (
                        <span className="fpt-payment-method">{row.paymentMethod}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="fpt-batch-tag">{row.batch}</span>
                  </td>
                  <td>
                    <span className="fpt-amount-text">{row.amount}</span>
                  </td>
                  <td>
                    <div className="fpt-due-cell">
                      <span className="fpt-paid-text">{row.paidAmount}</span>
                      <span className="fpt-due-date">{row.dueDate}</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <span className={`fpt-status-badge status-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeePaymentTracking;
