const add = require('./index')

test('adds two numbers together', ()=>{
    expect(add.add(1,2)).toBe(3)
})