
import fs from 'fs'
import { utilService } from './util.service.js'
import { loggerService } from './logger.service.js'

export const toyService = {
    query,
    getById,
    remove,
    save,
    getLabels,
    getPricesPerLabel,
    getInventoryByLabel,
    getLabelStats
}

const PAGE_SIZE = 5
const toys = utilService.readJsonFile('data/toy.json')

function query(filterBy = { txt: '' }) {
    const regex = new RegExp(filterBy.txt, 'i')
    var toysToReturn = toys.filter(toy => regex.test(toy.name))

    if (filterBy.price !== undefined) {
        toysToReturn = toysToReturn.filter(toy => toy.price <= filterBy.price)
    }

    if (filterBy.inStock === 'true') {
        toysToReturn = toysToReturn.filter(toy => toy.inStock === true)
    } else if (filterBy.inStock === 'false') {
        toysToReturn = toysToReturn.filter(toy => toy.inStock === false)
    }

    if (filterBy.labels && filterBy.labels.length > 0) {
        toysToReturn = toysToReturn.filter(toy =>
            filterBy.labels.every(label => toy.labels.includes(label))
        )
    }

    if (filterBy.sort) {
        if (filterBy.sort === 'name') {
            toysToReturn = toysToReturn.sort((a, b) => a.name.localeCompare(b.name))
        } else if (filterBy.sort === 'price') {
            toysToReturn = toysToReturn.sort((a, b) => a.price - b.price)
        } else if (filterBy.sort === 'createdAt') {
            toysToReturn = toysToReturn.sort((a, b) => a.createdAt - b.createdAt)
        }
    }

    if (filterBy.pageIdx !== undefined) {
        const startIdx = filterBy.pageIdx * PAGE_SIZE
        toysToReturn = toysToReturn.slice(startIdx, startIdx + PAGE_SIZE)
    }
    return Promise.resolve(toysToReturn)
}

function getById(toyId) {
    const toy = toys.find(toy => toy._id === toyId)
    return Promise.resolve(toy)
}

function remove(toyId, loggedinUser) {
    const idx = toys.findIndex(toy => toy._id === toyId)
    if (idx === -1) return Promise.reject('No Such Toy')

    const toy = toys[idx]
    if (!loggedinUser.isAdmin &&
        toy.owner._id !== loggedinUser._id) {
        return Promise.reject('Not your toy')
    }
    toys.splice(idx, 1)
    return _saveToysToFile()
}

function save(toy, loggedinUser) {
    if (toy._id) {
        const toyToUpdate = toys.find(currToy => currToy._id === toy._id)
        if (!toyToUpdate) return Promise.reject('Toy not found')
        if (!loggedinUser.isAdmin &&
            toyToUpdate.owner._id !== loggedinUser._id) {
            return Promise.reject('Not your toy')
        }
        toyToUpdate.name = toy.name
        toyToUpdate.imgUrl = toy.imgUrl
        toyToUpdate.price = toy.price
        toyToUpdate.labels = toy.labels
        toyToUpdate.inStock = toy.inStock

        toy = toyToUpdate
    } else {
        toy._id = utilService.makeId()
        toy.createdAt = Date.now()
        toy.owner = loggedinUser
        toys.push(toy)
    }
    if (toy.owner) delete toy.owner.score
    return _saveToysToFile().then(() => toy)
}

function getLabels() {
    const uniqueLabels = []
    toys.forEach(toy => {
        if (Array.isArray(toy.labels)) {
            toy.labels.forEach(label => {
                if (!uniqueLabels.includes(label)) {
                    uniqueLabels.push(label)
                }
            })
        }
    })

    return Promise.resolve(uniqueLabels)
}

// TODO: Try to combine both of these functions using array.reduce 
function getLabelStats() {
    const labelStats = toys.reduce((acc, toy) => {
        if (!Array.isArray(toy.labels)) return acc
        
        toy.labels.forEach(label => {
            if (!acc[label]) {
                acc[label] = {
                    prices: [],
                    avgPrice: 0,
                    total: 0,
                    inStock: 0,
                    percent: 0
                }
            }
            acc[label].prices.push(toy.price)
            
            acc[label].total++
            if (toy.inStock === true || toy.inStock === 'true') {
                acc[label].inStock++
            }
        })
        
        return acc
    }, {})
    
    for (const label in labelStats) {
        const stat = labelStats[label]
        
        const avg = stat.prices.reduce((sum, p) => sum + p, 0) / stat.prices.length
        stat.avgPrice = +avg.toFixed(2)
        
        stat.percent = +((stat.inStock / stat.total) * 100).toFixed(2)
    }
    
    return Promise.resolve(labelStats)
}

function getPricesPerLabel() {
    const pricesMap = {}

    toys.forEach(toy => {
        if (!Array.isArray(toy.labels)) return

        toy.labels.forEach(label => {
            if (!pricesMap[label]) {
                pricesMap[label] = {
                    prices: [],
                    avgPrice: 0
                }
            }
            pricesMap[label].prices.push(toy.price)
        })
    })

    for (const label in pricesMap) {
        const prices = pricesMap[label].prices
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
        pricesMap[label].avgPrice = +avg.toFixed(2)
    }

    return Promise.resolve(pricesMap)
}

function getInventoryByLabel() {
    const labelCounts = {}
    const labelInStockCounts = {}
    toys.forEach(toy => {
        if (!Array.isArray(toy.labels)) return
        toy.labels.forEach(label => {
            labelCounts[label] = (labelCounts[label] || 0) + 1
            if (toy.inStock === true || toy.inStock === 'true') {
                labelInStockCounts[label] = (labelInStockCounts[label] || 0) + 1
            }
        })
    })
    const result = {}
    for (const label in labelCounts) {
        const total = labelCounts[label]
        const inStock = labelInStockCounts[label] || 0
        const percent = +((inStock / total) * 100).toFixed(2)

        result[label] = {
            total,
            inStock,
            percent
        }
    }
    return Promise.resolve(result)
}



function _saveToysToFile() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(toys, null, 2)
        fs.writeFile('data/toy.json', data, (err) => {
            if (err) {
                loggerService.error('Cannot write to toys file', err)
                return reject(err)
            }
            resolve()
        })
    })
}