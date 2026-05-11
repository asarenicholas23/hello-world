const admin = require('firebase-admin')
admin.initializeApp()

const { sendFacilitySms }       = require('./sms/onCall')
const { sendNotificationEmail } = require('./email/onNotification')
const { birthdayReminders }     = require('./email/onBirthday')

exports.sendFacilitySms       = sendFacilitySms
exports.sendNotificationEmail = sendNotificationEmail
exports.birthdayReminders     = birthdayReminders
