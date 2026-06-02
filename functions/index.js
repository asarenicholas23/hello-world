const admin = require('firebase-admin')
admin.initializeApp()

const { sendFacilitySms }       = require('./sms/onCall')
const { sendNotificationEmail } = require('./email/onNotification')
const { birthdayReminders }     = require('./email/onBirthday')
const { chatbot }               = require('./chatbot')

exports.sendFacilitySms       = sendFacilitySms
exports.sendNotificationEmail = sendNotificationEmail
exports.birthdayReminders     = birthdayReminders
exports.chatbot               = chatbot
