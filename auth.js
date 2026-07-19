function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'Class 7';
}

function getStudentPassword() {
  return process.env.STUDENT_PASSWORD || 'Class 7';
}

function isAdminPasswordValid(password) {
  return typeof password === 'string' && password === getAdminPassword();
}

function isStudentPasswordValid(password) {
  return typeof password === 'string' && password === getStudentPassword();
}

module.exports = {
  getAdminPassword,
  getStudentPassword,
  isAdminPasswordValid,
  isStudentPasswordValid
};
