import React from 'react';
import './App.css';
import moment from 'moment';
import smoothscroll from 'smoothscroll-polyfill';

import Tone from "tone";

// Use polyfill to enable smoothscroll on safari
smoothscroll.polyfill();

// Load sounds
let tpRoll1 = new Tone.Player("./pullback_1.wav").toMaster();
tpRoll1.playbackRate = 1.5;
let tpRoll2 = new Tone.Player("./pullback_2.wav").toMaster();
let tpClick = new Tone.Player("./typewriter.wav").toMaster();
let scroll = new Tone.Player("./scroll.wav").toMaster();
let ding = new Tone.Player("./bell.wav").toMaster();
ding.volume.value = -8; // Lower volume for ding

class Typewriter extends React.Component {
  constructor(props) {
    super(props);
    this.state = Object.assign({}, {
      writtenString: "",
      paperMarginPercent: 80,
      enterIsPressed: false,
      horizontalScroll: true,
      noTextWrap: true,
      isAtEndOfLine: false,
      shouldResetView: false,
      });
    this.paperRef = React.createRef();
    this.lastCharRef = React.createRef();
    this.paperMarginRef = React.createRef();
    
    this.nonWrittenKeys = ["Shift", "CapsLock", "Tab", "Dead",
    "Escape", "Meta", "Control", "Alt", "Backspace", "Enter",
    "ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight",
  ];

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.addStringToWrittenText = this.addStringToWrittenText.bind(this);
    this.removeLastCharFromWrittenText = this.removeLastCharFromWrittenText.bind(this);
    this.handleCheckboxChange = this.handleCheckboxChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.calculateWidthOfLastRowOfText = this.calculateWidthOfLastRowOfText.bind(this);

    this.leftMargin = "auto"; // Default value
    this.paperLeftMargin = 0; //this.leftMargin + 10% (currently) of paper width in comparison with paper
    this.writableRowLength = 0;
    this.writingStartPosition = 0;

    this.textCanvas = document.createElement("canvas");
    this.font = "26px monospace";

    this.config = {
      allowBackspace: true,
    }

    this.currentDay = moment().format("dddd");
    this.currentDate = moment().format("MMMM Do YYYY");
  }

  componentDidMount() {
    this.paperRef.current.focus();

    let horizontalPos = "auto";
    let verticalPos = "3em";

    let node = this.paperRef.current;
    let nodeStyle = window.getComputedStyle(node);
    let marginLeft = nodeStyle.getPropertyValue('margin-left')
    let marginTop = nodeStyle.getPropertyValue('margin-top')
    horizontalPos = parseInt(marginLeft.substring(0, marginLeft.length-2));
    verticalPos = parseInt(marginTop.substring(0, marginTop.length-2));

    // Also set default margin
    this.leftMargin = horizontalPos;

    // Get writeable width
    const paperMarginRect = this.paperMarginRef.current.getBoundingClientRect();
    this.writableRowLength = paperMarginRect.width;
    
    this.writingStartPosition = window.scrollX + paperMarginRect.x;

    // Default scroll position
    window.scrollTo(
      window.innerWidth/2,
      0
    );
 }

  mergeState(newState) {
    // Merges state so that animation state is reset on every setState
    this.setState(Object.assign({}, newState));
  }

  handleCheckboxChange = (event) => {
    this.mergeState({
      horizontalScroll: !this.state.horizontalScroll
    })
  }

  handleKeyUp = (charRef) => (event) => {
    switch (event.key) {
      case "Enter":
        tpRoll2.restart().start();
        this.mergeState({
          enterIsPressed: false,
          isAtEndOfLine: false,
        });
        break;
      default:
        break;
    }

  }

  handleKeyDown = (charRef) => (event) => {
    let soundToPlay = tpClick;

     if (!event.repeat) {
      // Prevent annoying meta key conflicts
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case "Backspace":
            //Clear document and reset view
            this.mergeState({
              writtenString: "",
            })
            // Reset scroll view as well
            window.scrollTo(
              window.innerWidth/2,
              0
            );
            break;
          case "ArrowRight":
              this.mergeState({
                paperMarginPercent: this.state.paperMarginPercent > 0 ? this.state.paperMarginPercent - 10 : 0
              });
            break;
          case "ArrowLeft":
              this.mergeState({
                paperMarginPercent: this.state.paperMarginPercent < 100 ? this.state.paperMarginPercent + 10 : 100
              });
            break;
          default:
            break;
        }
        tpClick.restart().start();
        return;
      }

       if (this.nonWrittenKeys.includes(event.key)) {

        switch (event.key) {
          case "Escape":
            // Escape resets view if in horizontal mode
            this.mergeState({
              horizontalScroll: !this.state.horizontalScroll,
              shouldResetView: false,
            })
            this.shouldResetViewIfHorizontalMode(true);
            break;
          case "Enter":
          this.addStringToWrittenText("\n");
          soundToPlay = tpRoll1; // Play roll sound
            this.mergeState({
              enterIsPressed: true,
              shouldResetView: false, // Enter back to edit mode
            })
            break;
          case "Tab":
          event.preventDefault();
            break;
            case "Backspace":
            if (this.config.allowBackspace) {
              this.shouldResetViewIfHorizontalMode(false); // GO back to edit mode
              this.removeLastCharFromWrittenText();
            }
            break;
            // Arrow keys scroll
          case "ArrowDown":
          case "ArrowUp":
            soundToPlay = scroll;
            break;
          default:
        }
      } else {
        this.shouldResetViewIfHorizontalMode(false); // GO back to edit mode
        if (event.key === " ") {
          event.preventDefault();
        }
        // Prevent further input if at end of line
        if (this.state.noTextWrap) {
          // If text shouldn't wrap, check if we overflow page margins
          const textLength = this.calculateWidthOfLastRowOfText(this.state.writtenString + event.key);
          if (textLength > this.writableRowLength) {
            if (!this.state.isAtEndOfLine) {
              // If this is the first time we encounter this - play ding sound
              // Sound ding, set state, don't allow character to be written
              soundToPlay = ding;
              soundToPlay.restart().start();
              this.mergeState({
                isAtEndOfLine: true,
              })
              // break func execution
              return;
            } else {
              // If we've already encountered it, play other sound prevent further input
              if (this.state.isAtEndOfLine) {
                soundToPlay = tpRoll2;
                soundToPlay.restart().start();
                event.preventDefault();
                return;
              }
            }
          }
        }
        this.addStringToWrittenText(event.key);
      }
      soundToPlay.restart().start();
    } else {
      event.preventDefault();
    }
  }

  shouldResetViewIfHorizontalMode(shouldResetView) {
    if (this.state.horizontalScroll) {
      this.mergeState({
        shouldResetView: shouldResetView // Go back to edit mode
      });
    }
  }

  addStringToWrittenText(string) {
    let newString = this.state.writtenString;
    newString += string;
    this.mergeState({
      writtenString: newString,
    });
  }

  removeLastCharFromWrittenText() {
    let newString = this.state.writtenString;
    newString = newString.substring(0, newString.length-1);
    this.mergeState({
      writtenString: newString,
    });
  }

  calculateWidthOfLastRowOfText(text) {
    // Takes a big text, splits at \n and calculates the length of current row (last row)
    const textRows = text.split("\n");
    const lastRow = textRows[textRows.length -1];
    const charArray = Array.from(lastRow);
    const textWidth = this.getTextWidth(charArray.join(''));
    return textWidth;
  }

  getTextWidth(text) {
    const font = this.font;
    const canvas = this.textCanvas;
    const context = canvas.getContext("2d");
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width;
  }

  handleBlur(event) {
    event.target.focus(); // Force focus
  }

  printText(charArray) {
    return charArray.map((char, index) => {
      if (char === "\n") {
        if (index === charArray.length-1) {
          return <br ref={this.lastCharRef} key={index}/>;
        } else {
          return <br key={index}/>;
        }
      } else if (index === charArray.length-1) {
        return <span ref={this.lastCharRef} key={index}>{char}</span>;
      } else {
        return <span key={index}>{char}</span>;
      }
    });
  }

  componentDidUpdate(prevProps, prevState) {

    if (!this.state.horizontalScroll && this.state.horizontalScroll !== prevState.horizontalScroll) {
      // If there was a change in scroll mode, reset horizontal scroll default
      window.scrollTo(
        window.innerWidth/2,
        window.scrollY
      );
    }

    if (this.lastCharRef.current) {

      const charRefRect = this.lastCharRef.current.getBoundingClientRect();

      let horizontalScrollPos = window.scrollX; // Default horizontal value is current scroll
      let verticalScrollPos = window.scrollY + charRefRect.top - (charRefRect.height * 5);

      if (this.state.horizontalScroll) {
        horizontalScrollPos = window.scrollX + charRefRect.left - window.innerWidth/2; // Offset is half of window.innerWidth

        if (this.state.enterIsPressed) {
          horizontalScrollPos = Math.floor(this.writingStartPosition) - (window.innerWidth/2); // move back
        } else {
          if (this.lastCharRef.current.tagName === "BR") {
            verticalScrollPos += charRefRect.height;
            horizontalScrollPos = Math.floor(this.writingStartPosition) - (window.innerWidth/2);
          }
        }
      } else {
        if (this.state.enterIsPressed) {
          verticalScrollPos = window.scrollY;
        } else {
          if (this.lastCharRef.current.tagName === "BR") {
            verticalScrollPos += charRefRect.height;
          }
        }
      }
      window.scrollTo(
        Math.floor(horizontalScrollPos),
        Math.floor(verticalScrollPos)
        )
    }

    if (this.state.shouldResetView) {
      // Will reset view
      window.scrollTo(
        window.innerWidth/2,
        window.scrollY
      );
    }
  }
  
  render() {
    const printedText = this.printText(Array.from(this.state.writtenString));
    const nrOfBr = Array.from(this.state.writtenString).filter((char) => char ===  "\n").length;

    return (
      <div>
        <div name="paper"
          ref={this.paperRef}
          className="paper"
          onBlur={this.handleBlur}
          style={{
            height: 2000 + (nrOfBr*40) //TODO: Need a way to test/detect char height from font
          }}
          onKeyDown={this.handleKeyDown(this.lastCharRef.current)}
          onKeyUp={this.handleKeyUp(this.lastCharRef.current)}
          tabIndex="0">
          <p className="timestamp" style={{paddingTop: "1.5em"}}>{this.currentDay}</p>
          <p className="timestamp">{this.currentDate}</p>
          <p className="timestamp">-------------</p>
            <div className="paperMargins" ref={this.paperMarginRef} style={{width: this.state.paperMarginPercent + "%"}}>
              {printedText}
            </div>
        </div>
      </div>
    );
  }
}

export default Typewriter;
