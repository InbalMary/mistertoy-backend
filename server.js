import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

import { toyService } from './services/toy.service.js'
import { userService } from './services/user.service.js'
import { loggerService } from './services/logger.service.js'

const app = express()

const corsOptions = {
    origin: [
        'http://127.0.0.1:8080',
        'http://localhost:8080',
        'http://127.0.0.1:5173',
        'http://localhost:5173'
    ],
    credentials: true
}

// Express Config:
app.use(express.static('public'))
app.use(cors(corsOptions))
app.use(cookieParser())
app.use(express.json())
app.set('query parser', 'extended')


//* REST API for Toys
app.get('/api/toy', (req, res) => {
    const filterBy = {
        txt: req.query.txt || '',
        price: req.query.price ? +req.query.price : Infinity,
        inStock: req.query.inStock, 
        labels: req.query.labels ? req.query.labels.split(',') : [],
        sort: req.query.sort || ''
    }
    toyService.query(filterBy)
        .then(toys => res.send(toys))
        .catch(err => {
            loggerService.error('Cannot get toys', err)
            res.status(400).send('Cannot get toys')
        })
})

app.get('/api/toy/labels', (req, res) => {
    toyService.getLabels()
        .then(labels => res.send(labels))
        .catch(err => {
            loggerService.error('Cannot get labels', err)
            res.status(500).send('Cannot get labels')
        })
})

app.get('/api/toy/stats-per-label', (req, res) => {
    toyService.getLabelStats()
        .then(statsMap => res.send(statsMap))
        .catch(err => {
            loggerService.error('Cannot get stats per label', err)
            res.status(500).send('Cannot get stats per label')
        })
})

app.get('/api/toy/prices-per-label', (req, res) => {
    toyService.getPricesPerLabel()
        .then(pricesMap => res.send(pricesMap))
        .catch(err => {
            loggerService.error('Cannot get prices per label', err)
            res.status(500).send('Cannot get prices per label')
        })
})

app.get('/api/toy/inventory-by-label', (req, res) => {
    toyService.getInventoryByLabel()
        .then(inventoryMap => res.send(inventoryMap))
        .catch(err => {
            loggerService.error('Cannot get inventory by label', err)
            res.status(500).send('Cannot get inventory by label')
        })
})


app.get('/api/toy/:toyId', (req, res) => {
    const { toyId } = req.params

    toyService.getById(toyId)
        .then(toy => res.send(toy))
        .catch(err => {
            loggerService.error('Cannot get toy', err)
            res.status(400).send('Cannot get toy')
        })
})

app.post('/api/toy', (req, res) => {
    const loggedinUser = userService.validateToken(req.cookies.loginToken)
    if (!loggedinUser) return res.status(401).send('Cannot add toy')

    const toy = {
        name: req.body.name || 'New Toy',
        imgUrl: req.body.imgUrl || `https://robohash.org/${Math.random()}`,
        price: +req.body.price || 0,
        labels: req.body.labels || [],
        createdAt: req.body.createdAt || Date.now(),
        inStock: req.body.inStock !== undefined ? req.body.inStock : true,
        owner: {
            _id: loggedinUser._id,
            fullname: loggedinUser.fullname,
            score: loggedinUser.score || 0
        }
    }
    toyService.save(toy, loggedinUser)
        .then(savedToy => res.send(savedToy))
        .catch(err => {
            loggerService.error('Cannot save toy', err)
            res.status(400).send('Cannot save toy')
        })
})

app.put('/api/toy/:id', (req, res) => {
    const loggedinUser = userService.validateToken(req.cookies.loginToken)
    if (!loggedinUser) return res.status(401).send('Cannot update toy')

    const toy = {
        _id: req.params.id,
        name: req.body.name || 'Updated Toy',
        imgUrl: req.body.imgUrl || `https://robohash.org/${Math.random()}`,
        price: +req.body.price || 0,
        labels: req.body.labels || [],
        createdAt: req.body.createdAt || Date.now(),
        inStock: req.body.inStock !== undefined ? req.body.inStock : true,
        owner: req.body.owner || {
            _id: loggedinUser._id,
            fullname: loggedinUser.fullname,
            score: loggedinUser.score || 0
        }
    }

    toyService.save(toy, loggedinUser)
        .then(savedToy => res.send(savedToy))
        .catch(err => {
            loggerService.error('Cannot save toy', err)
            res.status(400).send('Cannot save toy')
        })
})

app.delete('/api/toy/:toyId', (req, res) => {
    const loggedinUser = userService.validateToken(req.cookies.loginToken)
    if (!loggedinUser) return res.status(401).send('Cannot remove toy')

    const { toyId } = req.params
    toyService.remove(toyId, loggedinUser)
        .then(() => res.send('Removed!'))
        .catch(err => {
            loggerService.error('Cannot remove toy', err)
            res.status(400).send('Cannot remove toy')
        })
})

// User API
app.get('/api/user', (req, res) => {
    userService.query()
        .then(users => res.send(users))
        .catch(err => {
            loggerService.error('Cannot load users', err)
            res.status(400).send('Cannot load users')
        })
})



app.get('/api/user/:userId', (req, res) => {
    const { userId } = req.params

    userService.getById(userId)
        .then(user => res.send(user))
        .catch(err => {
            loggerService.error('Cannot load user', err)
            res.status(400).send('Cannot load user')
        })
})

// Auth API
app.post('/api/auth/login', (req, res) => {
    const credentials = req.body

    userService.checkLogin(credentials)
        .then(user => {
            if (user) {
                const loginToken = userService.getLoginToken(user)
                res.cookie('loginToken', loginToken)
                res.send(user)
            } else {
                res.status(401).send('Invalid Credentials')
            }
        })
        .catch(err => {
            loggerService.error('Cannot login', err)
            res.status(400).send('Cannot login')
        })
})

app.post('/api/auth/signup', (req, res) => {
    const credentials = req.body

    userService.save(credentials)
        .then(user => {
            if (user) {
                const loginToken = userService.getLoginToken(user)
                res.cookie('loginToken', loginToken)
                res.send(user)
            } else {
                res.status(400).send('Cannot signup')
            }
        })
        .catch(err => {
            loggerService.error('Cannot signup', err)
            res.status(400).send('Cannot signup')
        })
})

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('loginToken')
    res.send('logged-out!')
})


app.put('/api/user', (req, res) => {
    const loggedinUser = userService.validateToken(req.cookies.loginToken)
    if (!loggedinUser) return res.status(400).send('No logged in user')
    const { diff } = req.body
    if (loggedinUser.score + diff < 0) return res.status(400).send('No credit')
    loggedinUser.score += diff
    return userService.save(loggedinUser)
        .then(user => {
            const token = userService.getLoginToken(user)
            res.cookie('loginToken', token)
            res.send(user)
        })
        .catch(err => {
            loggerService.error('Cannot edit user', err)
            res.status(400).send('Cannot edit user')
        })
})


// Fallback route
app.get('/*all', (req, res) => {
    res.sendFile(path.resolve('public/index.html'))
})

const PORT = process.env.PORT || 3030
app.listen(PORT, () =>
    loggerService.info(`Server listening on port http://127.0.0.1:${PORT}/`)
)
