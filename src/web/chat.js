const messagesContainer = document.getElementById('chat-messages')
const messageInput = document.getElementById('message-input')
const phoneInput = document.getElementById('phone-input')
const sendBtn = document.getElementById('send-btn')

const scrollToBottom = () => {
  messagesContainer.scrollTop = messagesContainer.scrollHeight
}

const appendMessage = (text, type) => {
  const div = document.createElement('div')
  div.className = `message ${type}`
  div.textContent = text
  messagesContainer.appendChild(div)
  scrollToBottom()
}

const sendMessage = async () => {
  const text = messageInput.value.trim()
  const phone = phoneInput.value.trim()
  
  if (!text || !phone) return
  
  // Show sent message immediately
  appendMessage(text, 'sent')
  messageInput.value = ''
  
  try {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, text })
    })
    
    if (!res.ok) throw new Error('Network error')
    
    const data = await res.json()
    
    if (data.reply) {
      appendMessage(data.reply, 'received')
    }
  } catch (error) {
    appendMessage('❌ Error de conexión con el servidor', 'system')
    console.error(error)
  }
}

sendBtn.addEventListener('click', sendMessage)

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage()
  }
})

// Poner el cursor en el input al cargar
messageInput.focus()
