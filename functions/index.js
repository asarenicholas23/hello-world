const admin = require('firebase-admin')
admin.initializeApp()

const { dailyPermitReminders, weeklyUnpaidReminders } = require('./sms/scheduled')
const { sendFacilitySms }       = require('./sms/onCall')
const { sendNotificationEmail } = require('./email/onNotification')
const { birthdayReminders }     = require('./email/onBirthday')

exports.dailyPermitReminders  = dailyPermitReminders
exports.weeklyUnpaidReminders = weeklyUnpaidReminders
exports.sendFacilitySms       = sendFacilitySms
exports.sendNotificationEmail = sendNotificationEmail
exports.birthdayReminders     = birthdayReminders
