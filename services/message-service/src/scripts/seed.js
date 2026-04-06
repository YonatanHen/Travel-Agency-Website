const Message = require('../models/Message')
const { connectToMongoDB } = require('@travel-agency/shared-utils')

async function seed() {
  let connection = null

  try {
    // Connect to database
    const dbConfig = require('../utils/database')
    const config = require('@travel-agency/shared-config').get('message-service')

    connection = await dbConfig.connect(config.mongodb.url, config.mongodb.database)
    console.log('[message-service] Connected to MongoDB for seeding')

    // Check if messages already exist
    const count = await Message.countDocuments()
    if (count > 0) {
      console.log(`[message-service] Database already contains ${count} messages. Skipping seed.`)
      process.exit(0)
    }

    // Create sample messages
    const now = new Date()
    const messages = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        subject: 'Inquiry about Paris trip',
        message: 'Hello, I am interested in the Paris Getaway package for 2 adults. Can you provide more details about the itinerary and hotel accommodations?',
        priority: 'high',
        isRead: false,
        metadata: {
          isSpam: false,
          spamScore: 0,
          source: 'contact-form'
        }
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        subject: 'Booking confirmation needed',
        message: 'I booked the Tokyo Adventure tour last week but haven\'t received a confirmation email. Please check my booking status.',
        priority: 'medium',
        isRead: true,
        repliedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        repliedBy: 'Admin Agent',
        metadata: {
          isSpam: false,
          spamScore: 0,
          source: 'contact-form'
        }
      },
      {
        name: 'Spammer123',
        email: 'spammer@tempmail.org',
        subject: 'FREE MONEY NOW!!!!!',
        message: 'Congratulations! You have won $1,000,000! Click here to claim your prize immediately! LIMITED TIME OFFER!!!!!',
        priority: 'low',
        isRead: false,
        metadata: {
          isSpam: true,
          spamScore: 85,
          reasons: ['Disposable email domain', 'Contains spam keyword: free money', 'Subject is all caps'],
          source: 'contact-form'
        }
      },
      {
        name: 'Bob Wilson',
        email: 'bob.wilson@example.com',
        subject: 'Special request for Maldives trip',
        message: 'We are planning our anniversary trip and would like to arrange a special dinner on the beach. Also, we have dietary restrictions - vegetarian and gluten-free. Please let us know if this can be accommodated.',
        priority: 'medium',
        isRead: false,
        metadata: {
          isSpam: false,
          spamScore: 0,
          source: 'contact-form'
        }
      },
      {
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        subject: 'Feedback on recent booking',
        message: 'Just wanted to say thank you for the wonderful experience in New York! The tour guide was excellent and the hotel was perfect. We will definitely book with you again.',
        priority: 'low',
        isRead: true,
        repliedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        repliedBy: 'Support Team',
        metadata: {
          isSpam: false,
          spamScore: 0,
          source: 'contact-form'
        }
      }
    ]

    await Message.insertMany(messages)
    console.log(`[message-service] Seeded ${messages.length} messages`)

    // Print summary
    const unreadCount = await Message.getUnreadCount()
    const stats = await Message.getStats()
    console.log(`[message-service] Unread messages: ${unreadCount}`)
    console.log('[message-service] Message statistics by priority:', stats)

    process.exit(0)
  } catch (error) {
    console.error('[message-service] Seed failed:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.close()
      console.log('[message-service] MongoDB connection closed')
    }
  }
}

seed()
