const ExcelJS = require('exceljs');
const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminPasswordValid(req.query.password)) return res.status(401).json({ error: 'Incorrect admin password' });

    const redis = getRedis();
    const all = (await redis.hgetall('users')) || {};
    const users = Object.values(all).sort((a, b) => new Date(b.login_time) - new Date(a.login_time));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shalimar Notice Board';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Student Logins');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Student Name', key: 'name', width: 32 },
      { header: 'Login Time', key: 'login_time', width: 26 },
      { header: 'Last Seen', key: 'last_seen', width: 26 }
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    users.forEach((u) => {
      sheet.addRow({
        id: u.id,
        name: u.name,
        login_time: u.login_time ? new Date(u.login_time).toLocaleString() : '',
        last_seen: u.last_seen ? new Date(u.last_seen).toLocaleString() : ''
      });
    });

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="shalimar-student-logins.xlsx"');
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('report error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
