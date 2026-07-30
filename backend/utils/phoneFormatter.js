function formatPhoneNumber(phone) {
  if (phone == null) return phone;
  let formatted = String(phone).trim().replace(/[^0-9+]/g, '');
  if (formatted === '') return formatted;
  
  if (formatted.startsWith('+62')) {
    formatted = '0' + formatted.slice(3);
  } else if (formatted.startsWith('62')) {
    formatted = '0' + formatted.slice(2);
  } else if (!formatted.startsWith('0')) {
    formatted = '0' + formatted;
  }
  return formatted;
}

module.exports = formatPhoneNumber;
