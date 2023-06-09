const jwt = require('jsonwebtoken');

const jwtVerifyF = (req, res, next)=>{

    const accessToken = req.headers.authorization
    if(!accessToken){
        return res.status(403).send({message: 'Unauthorized access'})
    }
    const accessTokenP = accessToken.split(' ')[1]

    jwt.verify(accessTokenP, process.env.JWT_TOKEN, (err, decoded)=>{
        if(err){
            return res.status(403).send({message: 'Unauthorized access'})
        }
        req.decoded = decoded
        next()
    })
}

module.exports = jwtVerifyF