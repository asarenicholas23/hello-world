const admin = require('firebase-admin')
admin.initializeApp()

const { dailyPermitReminders, weeklyUnpaidReminders } = require('./sms/scheduled')
const { sendFacilitySms } = require('./sms/onCall')

exports.dailyPermitReminders  = dailyPermitReminders
exports.weeklyUnpaidReminders = weeklyUnpaidReminders
exports.sendFacilitySms       = sendFacilitySms
