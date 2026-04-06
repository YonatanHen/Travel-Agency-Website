const Package = require('../models/Package')

async function seed() {
  try {
    const count = await Package.countDocuments()
    if (count > 0) {
      console.log('[package-service] Database already contains data. Skipping seed.')
      process.exit(0)
    }

    const packages = [
      {
        name: 'Paris Getaway',
        description: '7 days in Paris with hotel breakfast, museum passes, and Seine river cruise.',
        price: 1999,
        quantity: 50,
        destination: 'Paris',
        duration: 7,
        imageUrl: 'https://example.com/paris.jpg',
        amenities: ['Hotel', 'Breakfast', 'Tours'],
        rating: 4.7,
        reviewCount: 124,
        isActive: true
      },
      {
        name: 'Tokyo Adventure',
        description: '5 days exploring Tokyo with guided tours, sushi experience, and Mt. Fuji day trip.',
        price: 2500,
        quantity: 30,
        destination: 'Tokyo',
        duration: 5,
        imageUrl: 'https://example.com/tokyo.jpg',
        amenities: ['Guide', 'Meals', 'Transport'],
        rating: 4.9,
        reviewCount: 89,
        isActive: true
      },
      {
        name: 'Maldives Relaxation',
        description: '10 days of tropical paradise with overwater bungalow, all-inclusive meals, and snorkeling.',
        price: 5500,
        quantity: 20,
        destination: 'Maldives',
        duration: 10,
        imageUrl: 'https://example.com/maldives.jpg',
        amenities: ['All-Inclusive', 'Spa', 'Water Sports'],
        rating: 5.0,
        reviewCount: 45,
        isActive: true
      }
    ]

    await Package.insertMany(packages)
    console.log('[package-service] Seeded sample packages')
    process.exit(0)
  } catch (error) {
    console.error('[package-service] Seed failed:', error)
    process.exit(1)
  }
}

seed()
