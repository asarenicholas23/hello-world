const { initializeApp } = require('firebase-admin/app')
initializeApp()

const { sendFacilitySms }       = require('./sms/onCall')
const { sendNotificationEmail } = require('./email/onNotification')
const { birthdayReminders }     = require('./email/onBirthday')
const { sendFacilityEmail }     = require('./email/facilityEmail')
const { chatbot }               = require('./chatbot')

exports.sendFacilitySms       = sendFacilitySms
exports.sendNotificationEmail = sendNotificationEmail
exports.birthdayReminders     = birthdayReminders
exports.sendFacilityEmail     = sendFacilityEmail
exports.chatbot               = chatbot
