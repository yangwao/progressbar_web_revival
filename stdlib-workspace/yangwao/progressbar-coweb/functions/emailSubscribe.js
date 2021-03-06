/**
 * A basic email verification
 * @bg info
 * @param {string} email came in email
 @ @returns {object}
 */
module.exports = (email = 'non', context, callback) => {
  const config = {
    api: {
      baseWebUrl: 'https://cowork.progressbar.sk/'
    }
  }
  const uuidv4 = require('uuid/v4')
  const normalizeEmail = require('validator/lib/normalizeEmail')
  const isEmail = require('validator/lib/isEmail')
  const blacklist = require('validator/lib/blacklist')
  const mailgun = require('mailgun-js')({
    apiKey: process.env.mailgun_apiKey,
    domain: process.env.mailgun_domain
  })

  const firebase = require('firebase-admin')
  const firebaseConfig = {
    type: process.env.firebase_type,
    project_id: process.env.firebase_project_id,
    private_key_id: process.env.firebase_private_key_id,
    private_key: process.env.firebase_private_key,
    client_email: process.env.firebase_client_email,
    client_id: process.env.firebase_client_id,
    auth_uri: process.env.firebase_auth_uri,
    token_uri: process.env.firebase_token_uri,
    auth_provider_x509_cert_url: process.env.firebase_auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.firebase_client_x509_cert_url
  }

  if (firebase.apps.length === 0) {
    firebase.initializeApp({
      credential: firebase.credential.cert(firebaseConfig),
      databaseURL: 'https://coweb-bc478.firebaseio.com'
    })
  }
  const db = firebase.database()
  const ref = db.ref('server')
  const subscribersRef = ref.child('subscribers')

  if (email === 'non') {
    callback(null, {
      code: 'non'
    })
  }

  email = blacklist(email, '\',/')

  if (!isEmail(email) || email.length <= 10) {
    callback(null, {
      code: 'Not an email'
    })
  }

  if (isEmail(email) && email.length > 10) {
    let normalizedEmail = normalizeEmail(email)
    const hash = uuidv4()
    const mailmsg = {
      from: `Progressbar Cowork noreply <no-reply@${process.env.mailgun_domain}>`,
      to: normalizedEmail,
      subject: 'Progressbar Cowork Email Verification',
      text:
`Hello, looks like somebody tried use your email as registration mail.
If it was you, please confirm your email address ${normalizedEmail}
by clicking on link ${config.api.baseWebUrl}#/email/${hash}
If you did not request this email, please ignore it.
Humanoid from ${config.api.baseWebUrl}`
    }

    let newSub = {
      [uuidv4()]: {
        email: normalizedEmail,
        createdAt: Date.now(),
        hash
      }
    }

    let emails = []
    subscribersRef.once('value', function (data) {
      let dataRef = data.val()
      for (let uid of Object.keys(dataRef)) {
        emails.push(dataRef[uid].email)
      }

      let seenEmail = emails.find(x => x === normalizedEmail)

      if (seenEmail === normalizedEmail) {
        callback(null, {
          newSubscriberEmail: normalizedEmail,
          error: 'already requested mail',
          code: 'Please confirm your email'
        })
      }

      if (seenEmail === undefined) {
        subscribersRef.update(newSub, function (err) {
          if (err) {
            console.log('err', err)
            callback(null, {
              newSubscriberEmail: normalizedEmail,
              at: 1,
              code: 'Error occured, try later'
            })
          } else {
            mailgun.messages().send(mailmsg, function (error, body) {
              if (error) {
                console.log('mailgunErr', error)
                callback(null, {
                  newSubscriberEmail: normalizedEmail,
                  at: 2,
                  code: 'Error occured, try later'
                })
              }
              if (!error) {
                callback(null, {
                  newSubscriberEmail: normalizedEmail,
                  code: 'Email has been sent'
                })
              }
            })
          }
        })
      }
    })
  }
}
