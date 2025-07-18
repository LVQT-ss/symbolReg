# Symbol Recognition App

A React Native application that recognizes comparison symbols (>, <, =) drawn on a canvas.

## Features

- Interactive canvas for drawing symbols
- Real-time symbol recognition
- Support for three comparison symbols: >, <, =
- Clear canvas functionality
- User-friendly interface

## Requirements

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start the development server:

```bash
npm start
# or
yarn start
```

4. Run on your preferred platform:

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your physical device

## How to Use

1. The canvas is divided into two equal parts by a vertical line
2. Draw comparison symbols following these rules:
   - For ">" (greater than): Start from left side, end on right side
   - For "<" (less than): Start from right side, end on left side
   - For "=" (equals): Draw a horizontal line on either side
3. The recognized symbol will appear below the canvas
4. Use the "Clear Canvas" button to start over

## Technical Details

- Built with React Native and Expo
- Uses react-native-gesture-handler for touch interactions
- Implements react-native-reanimated for smooth animations
- Uses react-native-svg for drawing paths

## Performance

- Symbol recognition happens in real-time
- Drawing performance optimized for smooth experience
- Supports both iOS and Android platforms

---------------------------------------------
For summary of this project is for an e learning and exciting platform for children to play and learn at number the same time , compete with thier peer and along with user . Firstly, i want to deploy this app on android and practice on ios . but i will release both at the same time. 
About the project , it've been two days since i first came with this idea and saw it on facebook . 
17/5/2025 . i might have figure out that using the start point and end point of a drawing is the best option , when a user draw 2 point on 1 drawing on the left side it will recognize it as " > " and the opposite on the right size . but i have faced a draw back , the symbolReg code only know the where the point not what user drawing so that user might have draw on the left side and recognize the " > " but user might draw " < " so how to i fix this . i dont know yet . And lastly for the equal sight is just see the point is cross the middle line . 
 
