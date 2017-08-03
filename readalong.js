/**
 * HTML5 Audio Read-Along
 * @author Weston Ruter, X-Team
 * @modified Chad Jones - injectable object
 *  Some changes include: 
 *   Improved speed of getCurrentWord and class highlighting
 *   Simplified timers to use just one, improving reliability at higher speeds
 *   Added a bunch of consumer events (on_start, on_complete, on_pause, on_resume, on_newline)
 *   Made tags and classes somewhat configurable, with terse deaults
 *   Removed the tab index stuff (I probably shouldn't have)
 *   Changed seconds to ms
 *   Changed data-attributes to use a single 'data-map' attribute like data-map="7464,844"
 *   Wrapped code in instantiatable object with configuration in constructor
 *   If no audio src, src is extracted from block's data-audiosrc
 *   Added top-level play controls such as playBlock, pause, resume, playRange, playWord
 *   Audio element is created automatically and need not be provided in HTML
 * 
 * @license MIT/GPL
 * https://github.com/westonruter/html5-audio-read-along
 */

class ReadAlong {
    
  constructor(args, events, config) {
    let name = ''
    // default arguments
    let default_args = { 
      playbackRate: 1,
      prevOffsetTop: 0, 
      forceLineScroll: true,  
      keep_highlight_on_pause: true,
      highlight_trail: true
    }
    args = Object.assign(default_args, args)
    for (name in args) this[name] = args[name] 
    // default events
    let default_events = {
      on_pause: null,
      on_resume: null,
      on_move: null,
      on_start: null,
      on_complete: null,
      on_newline: null   
    }
    events = Object.assign(default_args, events)
    this.events = {}
    for (name in events) this.events[name] = events[name] 
    // default configuration
    let default_config = {
      block_attr: 'audiosrc',
      tag: 'w',
      map_attr: 'map',
      gap_attr: 'gap',
      gap_before_attr: 'gapbefore',
      reading_class: 'audio-highlight',
      trail_class: 'audio-trail' 
    }
    config = Object.assign(default_config, config)
    this.config={}
    for (name in config) this.config[name] = config[name]
    // setup audio player 
    if (!this.audio_element) this.audio_element = document.createElement('audio')
    this.playbackRate = Math.max(this.playbackRate, 0.5)
    this.playbackRate = Math.min(this.playbackRate, 2.0) 
    this.audio_element.playbackRate = this.playbackRate
    // internal stuff
    this._current_select_timeout = null 
    this._next_select_timeout = null
    this.words = []
    this.word = null
    this.last_word = null 
    this.block_duration = 0 
    this.block_duration_adjusted = 0 
  }

  playBlock  (blockid, speed=null) { 
    if (speed) this.changePlayRate(speed)
    // todo, if already playing, stop, clear and reset   
    this.blockid = blockid  
    this.block_element = document.getElementById(blockid) 
    // assign audio to src
    if (!this.audio_element.paused) this.audio_element.pause
    this.audio_src = this.block_element.dataset[this.config.block_attr]
    console.log('audio: ', this.audio_src, this.config.block_attr,  this.block_element.dataset)
    this.audio_element.src = this.audio_src 
    this.audio_element.playbackRate = this.playbackRate
    // clear out any previous activity
    this.word = null
    this.words = []
    // prep this block
    this.generateWordList()
    this.addEventListeners()
    this.selectCurrentWord()
    // I think we're all ready to go
    this.audio_element.play() 
  }
 

  playFromWord (word) { 
    // Note: times apparently cannot be exactly set and sometimes selected too early 
    this.audio_element.currentTime = (word.begin / 1000) + 0.01
    this.removeWordSelectionClass()
    this.selectCurrentWord() 
    if (this.audio_element.paused && word.index>0 && word && this.events.on_resume) this.events.on_resume(word)
    this.audio_element.play() 
  } 

  playWord (word) {
    this.playRange(word.begin, word.end)
  }

  playRange(start, stop) { 
    this.audio_element.pause()
    this.audio_element.currentTime = start / 1000  
    setTimeout(() => { this.audio_element.pause() }, Math.round((stop-start) * 1.0/this.audio_element.playbackRate))
    this.audio_element.play()  
  }

  resume () { 
    if (!this.audio_element.paused) return  
    let word = this.getCurrentWord()
    this.audio_element.play()
    if (this.events.on_resume) this.events.on_resume(word)
  }

  pause () { 
    this.audio_element.pause()
  }

  changePlayRate (playbackRate=1) {
    if (playbackRate === this.playbackRate) return
    playbackRate = Math.max(playbackRate, 0.5)
    playbackRate = Math.min(playbackRate, 2.0) 
    this.playbackRate = playbackRate
    this.audio_element.playbackRate = playbackRate
    //this.block_duration_adjusted = Math.round(this.block_duration* 1.0/this.playbackRate)
    //this.selectCurrentWord()
  }

  /**
   * Build an index of all of the words this can be read along with their begin,
   * and end times, and the DOM element representing the word.
   */
  generateWordList  () { 
    let word_els = this.block_element.querySelectorAll(`${this.config.tag}[data-${this.config.map_attr}]`);
    this.words = Array.prototype.map.call(word_els, function (word_el, index) {
    let [begin, dur, end=parseInt(begin)+parseInt(dur)] = word_el.dataset.map.split(',')
    word_el.dataset.index = index
    let word = {
      begin: parseInt(begin),
      end: end,
      dur: parseInt(dur),
      element: word_el,
      index: index,
      text: word_el.innerText,
      html: word_el.innerHTML
    } 
    return word;
    })  
    let lastWord = this.words[this.words.length-1] 
    this.block_duration = lastWord.begin+lastWord.end-this.words[0].begin
    this.block_duration_adjusted = Math.round(this.block_duration* 1.0/this.playbackRate)
  }

  /**
   * From the audio's currentTime, find the word that is currently being played
   * // chad: optimized by storing previous word for quick shortcut -- and binary search lookup 
   */
  getCurrentWord () { 
    let word = this.last_word
    let play_time = Math.round(this.audio_element.currentTime * 1000) // playhead time in ms
    // first, quickly check if last_word is still valid
    if (word && (word.begin<play_time) && (word.end>play_time)) return word 
    // otherwise, use quick binary search to lookup current word 
    let min = 0, max = this.words.length - 1, index 
    while (min <= max) {
      index = (min + max) / 2 | 0
      word = this.words[index]
      if (play_time > word.end) min = index + 1 
        else if (play_time < word.begin) max = index - 1 
          else return this.last_word = word
    }
    return this.last_word = word ; //this.words[index] 
  }

  /**
   * Select the current word and set timeout to select the next one if playing
   */
  selectCurrentWord () {
    let that = this
    let is_playing = !this.audio_element.paused
    let current_word = this.getCurrentWord() // very fast 
    if (!is_playing & !this.keep_highlight_on_pause) this.removeWordSelectionClass(current_word)  

    /**
     * The timeupdate Media event does not fire repeatedly enough to be
     * able to rely on for updating the selected word (it hovers around
     * 250ms resolution), so we add a setTimeout with the exact duration
     * of the word.
     */
    if (is_playing) {
      this.setWordSelectionClass(current_word, true) 
      // Automatically trigger selectCurrentWord when the next word begins
      if (current_word.index < this.words.length-1) {
        let current_time = this.audio_element.currentTime * 1000
        let playbackRate = 1.0/this.audio_element.playbackRate
        let next_word = this.words[current_word.index + 1]
        let ms_until_next = Math.max(Math.round((next_word.begin-current_time) * playbackRate),0) 
        if (this._next_select_timeout != null) { 
          // check if our timing is off. This should fire only at speed changes
          // console.log('Prematurely cleared nextword timer', ms_until_next)
          clearTimeout(this._next_select_timeout) 
        } 
        this._next_select_timeout = setTimeout( () => {
          this.selectCurrentWord()
          this._next_select_timeout = null
        }, ms_until_next)
      }  
    } else if (!this.keep_highlight_on_pause) this.removeWordSelectionClass(current_word)  

  }

  removeWordSelectionClass (word) { 
    // console.log('removeWordSelectionClass')
    let reading_class = this.config.reading_class
    let trail_class = this.config.trail_class 
    // Remove .audio-highlight and .audio-trail classes from current word and trail
    if (word) {
      word.element.classList.remove(reading_class, trail_class)
      if (word.index>0) this.words[word.index-1].element.classList.remove(reading_class, trail_class)
      if (word.index>1) this.words[word.index-2].element.classList.remove(reading_class, trail_class)  
    }  
    // this is slower since it requires querying, so we avoid it when possible 
    else {  
      var spoken_word_els = this.block_element.querySelectorAll(`.${reading_class}, .${trail_class}`) 
      Array.prototype.forEach.call(spoken_word_els, function (spoken_word_el) {
      spoken_word_el.classList.remove(reading_class, trail_class) 
      }) 
    }
  }

  setWordSelectionClass (word) {
    let reading_class = this.config.reading_class
    let trail_class = this.config.trail_class
    if (!word || !word.element) return // word = this.last_word
    let isNewline = (word.index>0) && (word.element.offsetTop> this.prevOffsetTop)
    word.element.classList.add(reading_class) 
    let percentComplete = Math.round((word.index+1)/this.words.length * 100)
    let onNewLine = this.events.on_newline
    if (isNewline && onNewLine) onNewLine(this.prevOffsetTop, word.element.offsetTop, percentComplete) 
    if (isNewline && this.forceLineScroll) this.lineScroll(word.element.offsetTop - this.prevOffsetTop)
    this.prevOffsetTop = word.element.offsetTop;
    // clear previous word highlight
    if (word.index>0) this.words[word.index-1].element.classList.remove(reading_class) 
    // clear previous words trail
    if (word.index>1) this.words[word.index-2].element.classList.remove(trail_class) 
    if (word.index>2) this.words[word.index-3].element.classList.remove(trail_class)  
    if (word.index>3) this.words[word.index-4].element.classList.remove(trail_class)     
    // when word changes line, flush everything before
    if (isNewline) { 
      for (let i=word.index-1; i>word.index-15 && i>0; i--) this.words[i].element.classList.remove(trail_class)   
    }  else if (this.highlight_trail && word.index>0) this.words[word.index-1].element.classList.add(trail_class) 
  }

  lineScroll(pixles) {
    // console.log('LineScroll', pixles)
    // TODO: implement browser scroll by # pixels
    window.scrollBy(0, pixles)
  }

  addEventListeners  () {
    var that = this

    /**
     * Select next word (at that.audio_element.currentTime) when playing begins
     */
    that.audio_element.addEventListener('play', function (e) {
      that.selectCurrentWord() 
    }, false);

    /**
     * Abandon seeking the next word because we're paused
     */
    that.audio_element.addEventListener('pause', function (e) { 
      that.selectCurrentWord() // We always want a word to be selected  
      let word = that.getCurrentWord() 
      let onPause = that.events.on_pause
      if ((word.index<that.words.length-1) && onPause) onPause(word) 
    }, false);

    /**
     * Event just for completion of block
     */
    that.audio_element.addEventListener('ended', function (e) {  
      if (that.events.on_complete) that.events.on_complete(that.blockid) 
    }, false);

    /**
     * Seek by selecting a word (event delegation)
     */
    function on_select_word_el(e) {  
      if (!e.target.dataset.map) return 
      e.preventDefault()  
      that.playFromWord(that.words[e.target.dataset.index]) 
    }

    // word click
    // that.block_element.addEventListener('click', on_select_word_el, false)
    // enter
    that.block_element.addEventListener('keypress', function (e) { 
      if ( (e.charCode || e.keyCode) === 13) on_select_word_el.call(this, e) 
    }, false)

    /**
     * Spacebar toggles playback
     */
    document.addEventListener('keypress', function (e) {
      // space bar
      if ( (e.charCode || e.keyCode) === 32) {
      e.preventDefault()
      if (that.audio_element.paused) that.resume()
        else that.audio_element.pause() 
      }
    }, false)

    /**
     * First click handler sets currentTime to the word, and second click
     * here then causes it to play.
     * @todo Should it stop playing once the duration is over?
     */
    that.block_element.addEventListener('dblclick', function (e) {
      e.preventDefault()
      //that.audio_element.play()
      //that.audio_element.pause()
      //let word = that.getCurrentWord()
      let word = that.words[e.target.dataset.index]
      that.playWord(word)
    }, false);

    /**
     * Select a word when seeking
     */
    that.audio_element.addEventListener('seeked', function (e) {
      that.selectCurrentWord()
      /**
       * Address probem with Chrome where sometimes it seems to get stuck upon seeked:
       * http://code.google.com/p/chromium/issues/detail?id=99749
      */
      var audio_element = this
      if (!audio_element.paused) {
      var previousTime = audio_element.currentTime
      setTimeout(function () {
        if (!audio_element.paused && previousTime === audio_element.currentTime) {
        audio_element.currentTime += 0.01 // Attempt to unstick
        }
      }, 500)
      // fire moved event 
      if (that.events.on_move) that.events.on_move(that.getCurrentWord())
      }  

    }, false)

    /**
     * Select a word when adjusting speed
     */
    that.audio_element.addEventListener('ratechange', function (e) {
      that.selectCurrentWord()
    }, false)

    /**
     * When audio begins, fire the on_start event, if assigned
     */
    that.audio_element.addEventListener('playing', function (e) { 
      let word = that.getCurrentWord()
      if (that.events.on_start && word.index===0) that.events.on_start(that.blockid, that.words, that.block_duration, that.playbackRate)
    }, false)

  }
}