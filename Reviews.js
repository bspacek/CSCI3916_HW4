var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.Promise = global.Promise;

try {
    mongoose.connect( process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true}, () =>
        console.log("connected"));
}catch (error) {
    console.log("could not connect");
}
//mongoose.set('useCreateIndex', true);

var ReviewSchema = new Schema({
    userReview: { type: String, required: true},
    rating: { type: Number, min: 1, max: 5, required: true },
    title: {type: String, required: true},
    username : { type : String, required: true},
});

ReviewSchema.index({title: 1, username: 1}, {unique: true});


// return the model
module.exports = mongoose.model('Review', ReviewSchema);