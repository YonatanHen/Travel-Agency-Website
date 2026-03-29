const sgMail = require('@sendgrid/mail')

// Validate that required environment variables are set
if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY is not set in environment variables')
}
if (!process.env.FROM_EMAIL) {
  throw new Error('FROM_EMAIL is not set in environment variables')
}

const api_key = process.env.SENDGRID_API_KEY
const fromEmail = process.env.FROM_EMAIL
sgMail.setApiKey(api_key)

router.post('/send-email', async (req, res) => {
	const email = req.body

	try {
		const msg = {
			to: email.email,
			from: fromEmail,
			subject: 'Register to PineApple Travels',
			text: 'Thank you for registering to PineApple Travels!',
		}

		sgMail.send(msg, (err) => {
			if (err) {
				console.log('email did not sent')
			} else {
				console.log(`email sent successfully to ${email.email}`)
			}
		})
	} catch (e) {
		console.log(e)
		res.status(500).send({ message: "Can't! send an email" })
	}
})
router.post('/send-email', async (req, res) => {
	const email = req.body

	try {
		const msg = {
			to: email.email,
			from: fromEmail,
			subject: 'Register to PineApple Travels',
			text: 'Thank you for registering to PineApple Travels!',
		}

		sgMail.send(msg, (err) => {
			if (err) {
				console.log('email did not sent')
			} else {
				console.log(`email sent successfully to ${email.email}`)
			}
		})
	} catch (e) {
		console.log(e)
		res.status(500).send({ message: "Can't! send an email" })
	}
})
router.post('/send-email-to', async (req, res) => {
	const sendTo = req.body
	const email = sendTo.email
	const subject = sendTo.subject
	const text = sendTo.text

	try {
		const msg = {
			to: email,
			from: fromEmail,
			subject: subject,
			text: text,
		}

		sgMail.send(msg)
		res.send(JSON.stringify('Did it!'))
	} catch (e) {
		console.log(e)
		res.status(500).send({ message: "Can't! send an email" })
	}
})
router.post('/send-broadcast-email', async (req, res) => {
	const email = req.body
	const emails = email.emails
	const text = email.text

	let msg

	try {
		msg = {
			to: emails,
			from: fromEmail,
			subject: 'Broadcast Message!',
			text: text,
		}

		sgMail.sendMultiple(msg, (err) => {
			if (err) {
				console.log(`email did not sent ${err}`)
				res.send()
			} else {
				console.log(`email sent successfully to ${emails}`)
			}
		})
	} catch (e) {
		console.log(e)
		res.status(500).send({ message: "Can't! send an email" })
	}
})

module.exports = router
