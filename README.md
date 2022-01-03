# mdmc-client
A desktop client for downloading and managing Muse Dash charts/maps/songs/albums downloaded from the [Muse Dash Modding Community Website](https://mdmc.moe/).

## Download
- You can download the latest pre-release `.exe` from https://github.com/jy1263/mdmc-client/releases/latest/
- Or the latest build from https://github.com/jy1263/mdmc-client/actions

## Features (So Far)
- Queue Charts to be Downloaded in the Background.
- Delete Charts from Your Library.
- Browse and Filter Charts that Are Listed on https://mdmc.moe/.
- View Leaderboards of Charts that Are Listed on https://musedash.moe/.

## To-Do
- [x] Strengthening safety through ContextIsolation
- [x] Finding and downloading charts using API from https://mdmc.moe/
- [x] Song Library Scanning and Management
- [x] Getting leaderboard scores using API from https://musedash.moe/
- [ ] Advanced Steam Directory Detection

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn electron:serve
```

### Compiles and minifies for production
```
yarn electron:build
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
