import React from 'react';
import './ServerTable.css';

const clients = [
  { id: 1, name: 'Aarav Sharma', course: 'Orbital Mechanics', payment: 'Paid', joined: '03 Jul 2026' },
  { id: 2, name: 'Meera Nair', course: 'Aerodynamics', payment: 'Pending', joined: '03 Jul 2026' },
  { id: 3, name: 'Ishaan Rao', course: 'Propulsion', payment: 'Paid', joined: '04 Jul 2026' },
  { id: 4, name: 'Kavya Reddy', course: 'Satellite Systems', payment: 'Paid', joined: '04 Jul 2026' },
];

const ClientTable = () => {
  return (
    <div className="table-card">
      <div className="table-header">
        <h2>Client Table</h2>
      </div>

      <table className="custom-table">
        <thead>
          <tr>
            <th>Client Name</th>
            <th>Course</th>
            <th>Payment</th>
            <th>Joined</th>
          </tr>
        </thead>

        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td>{client.course}</td>
              <td>
                <span className={`status ${client.payment === 'Paid' ? 'online' : 'maintenance'}`}>
                  {client.payment}
                </span>
              </td>
              <td>{client.joined}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClientTable;