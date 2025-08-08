require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Pterodactyl API Integration
const createPterodactylServer = async (packageType) => {
  try {
    // Dummy response for testing, remove in production
    if (process.env.NODE_ENV === 'test') {
      return {
        attributes: {
          id: 'srv-test123',
          name: 'Test Server',
          uuid: '12345678-1234-1234-1234567890ab'
        }
      };
    }

    const response = await axios.post(
      `${process.env.PTERODACTYL_URL}/api/application/servers`,
      {
        name: `Server-${Date.now()}`,
        user: 1, // Ganti dengan user ID yang valid di Pterodactyl
        egg: 1, // Ganti dengan egg ID yang valid
        docker_image: 'quay.io/pterodactyl/core:java',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
        environment: {
          SERVER_JARFILE: 'server.jar',
          EULA: 'true'
        },
        limits: {
          memory: getMemoryAllocation(packageType),
          swap: 0,
          disk: 10240,
          io: 500,
          cpu: 100
        },
        feature_limits: {
          databases: 0,
          allocations: 1
        },
        allocation: {
          default: 1 // Ganti dengan allocation ID yang valid
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PTERODACTYL_ADMIN_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'Application/vnd.pterodactyl.v1+json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Pterodactyl API Error:', error.response?.data || error.message);
    throw new Error('Failed to create server on Pterodactyl');
  }
};

function getMemoryAllocation(packageType) {
  const packages = {
    '1GB': 1024,
    '2GB': 2048,
    '4GB': 4096,
    '10GB': 10240,
    'Unlimited': 16384,
    'Admin Panel': 2048
  };
  return packages[packageType] || 1024;
}

// OrderKuota API Integration
app.post('/api/create-order', async (req, res) => {
  try {
    const { product, amount, email, phone, name } = req.body;

    // Dummy response for testing
    if (process.env.NODE_ENV === 'test') {
      return res.json({
        success: true,
        data: {
          order_id: 'TEST_ORDER_123',
          qr_code_url: 'https://dummyimage.com/200x200/000/fff&text=QR+Dummy',
          payment_url: 'https://dummyorderkuota.com/pay/TEST_ORDER_123'
        }
      });
    }

    const orderResponse = await axios.post(
      'https://orderkuota.com/api/v2/order',
      {
        product_code: process.env.ORDERKUOTA_PRODUCT_CODE,
        buyer_name: name,
        buyer_email: email,
        buyer_phone: phone,
        amount: amount
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.ORDERKUOTA_API_KEY}`
        }
      }
    );

    res.json(orderResponse.data);
  } catch (error) {
    console.error('OrderKuota API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Webhook for payment confirmation
app.post('/api/payment-callback', async (req, res) => {
  const { order_id, status, package } = req.body;

  if (status === 'success') {
    try {
      const serverDetails = await createPterodactylServer(package);
      // Simpan serverDetails ke database atau kirim email
      console.log('Server created:', serverDetails);
      // TODO: Kirim email/WhatsApp dengan kredensial server
      res.status(200).send('OK');
    } catch (error) {
      console.error('Server creation failed:', error.message);
      res.status(500).send('Server creation failed');
    }
  } else {
    res.status(400).send('Payment not successful');
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});