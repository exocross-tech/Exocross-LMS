import React from 'react';
import './ServerTable.css';

const servers = [
  { id: 1, name: 'LMS-API-01', status: 'Online', uptime: '12 days', load: '35%' },
  { id: 2, name: 'LMS-DB-01', status: 'Online', uptime: '25 days', load: '52%' },
  { id: 3, name: 'LMS-Auth-01', status: 'Maintenance', uptime: '3 days', load: '18%' },
  { id: 4, name: 'LMS-Storage-01', status: 'Online', uptime: '41 days', load: '67%' },
];

const ServerTable = () => {
  return (
    <div className="table-card">
      <div className="table-header">
        <h2>Server Table</h2>
      </div>

      <table className="custom-table">
        <thead>
          <tr>
            <th>Server Name</th>
            <th>Status</th>
            <th>Uptime</th>
            <th>Load</th>
          </tr>
        </thead>

        <tbody>
          {servers.map((server) => (
            <tr key={server.id}>
              <td>{server.name}</td>
              <td>
                <span className={`status ${server.status === 'Online' ? 'online' : 'maintenance'}`}>
                  {server.status}
                </span>
              </td>
              <td>{server.uptime}</td>
              <td>{server.load}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServerTable;