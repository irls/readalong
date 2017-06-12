// development area for testing modularization and adaptation or readalong
 
var ReadAlong = require('../readalong')
var Vue = require("vue/dist/vue.common.js")
var ra = new ReadAlong
var Type = require('js-binary').Type
var nlp = require('compromise')
var removePunctuation = require('remove-punctuation')
var $ = require('jquery')

var content = require('./content.json') 



// converts old map array into new encoded array
// function ra_getlegacymap(key) { 
//   if (!mapdat[key]) return false 
//   let m = mapdat[key].map 
//   let maparr = []
//   let first = m.shift()
//   maparr.push( parseInt(first[0]*1000) ) // keep intitial start point
//   maparr.push( parseInt(first[1]*1000) ) // initial word length
//   m.map((item) => { maparr.push( parseInt(item[1]*1000) ) } ) 
//   return mapdat[key].file +':'+ encodeIntArray(maparr) 
// }
// // now modify our sample content object
// content.content.map((block, index)=> { 
//   let map = ra_getlegacymap(block.id)
//   if (map) content.content[index].map = map 
// })

function decodeMap(mapkey) {
  //console.log(mapkey)
  let result = {file: '', map: []}
  //if (!mapkey) return result
  mapkey = mapkey.split(':')
  result.file = mapkey.shift()
  mapkey = mapkey[0].split(',')
  //let newMap = [] 
  // map keys can have multiple pieces
  mapkey.map((enc) => {
    let arr = decodeIntArray(enc)
    let w = {}
    // first word sets the starting position
    w.begin = arr.shift()
    w.dur = arr.shift()
    result.map.push(w)
    let nextbegin = w.begin + w.dur
    // now loop through remaining values
    for (i = 0; i < arr.length; i++) { 
      let w = {}
      w.dur = arr[i]  
      w.begin = nextbegin
      result.map.push(w)
      nextbegin = w.begin + w.dur
    }    
  })
  console.log(result)
  return result
}

function encodeIntArray(arr) {
  let schema = new Type( ['uint'] )    
  return schema.encode(arr).toString('base64') 
  //return schema.encode(arr).toString('hex') 
}
function decodeIntArray(enc) { 
  let schema = new Type( ['uint'] )  
  //return schema.decode(new Buffer(enc, 'hex'))
  return schema.decode(new Buffer(enc, 'base64'))
}

function wordWrap(html) {
  words = parse(html)
  words.map((word, i) => { words[i].word='<w>'+word.word+'</w>' })
  return unparse(words) 
}
// return array of objects describing each word
function parse(str) {
  var list = nlp(str).out('terms');
  var pos_options = {Noun:'noun', Verb:'verb', Adjective:'adj', Adverb:'adv'}; 
  // pull out parts we actually want
  var words = [];
  list.forEach((word, index) => { 
    let newword = {}
    newword.discard = word.tags.filter((tag)=>!pos_options[tag] )
    newword.pos = word.tags
     .filter((tag)=>pos_options[tag]).map((tag)=>pos_options[tag])
    newword.pos = newword.pos[0] || '' 
    newword.word = word.text 
    list[index] = newword
  }); 
  return list;
}
function unparse(arr) {
  let result = []
  arr.map((word) => result.push(word.word))
  return result.join(' ')
}
 



var app = new Vue({
  el: '#app',
  data: {
    title: ra.message ,
    html5audio: true,
    bookcontent: JSON.stringify(content, null, 4),
    blocks: content.content,
    audiomap: {}
  },
  methods: {
    blockContent: function(block) {
      if (block.map) {
        let map = decodeMap(block.map)
        this.audiomap[block.id] = map
        let words = parse(block.content)
        words.map((word, i) => { 
          words[i].word= `<w data-begin="${map.map[i].begin}" data-dur="${map.map[i].dur}">${word.word}</w>` 
        })
        return unparse(words) 
      } else {
        return block.content
      }
       
    },
    parseBlock: function (blockhtml) {      
      // return wordWrap(blockhtml)  
    },
    blockHasAudio: function(block) {
      return block['map'] ? 'true' : "false"
    },
    decodeBlockAudioMap: function(block) {
      // return decodeMap(block.map)
    } 
  }
  
})