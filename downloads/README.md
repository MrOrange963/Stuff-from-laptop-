# Tools Required — New Laptop Setup

Install these in order before opening any project files.

---

## 1. Git
Used to sync files to/from GitHub.
- Download: https://git-scm.com/download/win
- During install: choose "Git from the command line and also from 3rd-party software"
- After install, run in terminal:
  ```
  git config --global user.name "MrOrange963"
  git config --global user.email "joncloe1125@gmail.com"
  ```

## 2. Node.js (LTS version)
Required to run the managed-by-marcus React app.
- Download: https://nodejs.org/en/download
- Choose the **LTS** version (not Current)
- This also installs `npm` automatically

## 3. Visual Studio Code (VS Code)
Code editor used to view and edit all project files.
- Download: https://code.visualstudio.com/download

## 4. GitHub Account
- Username: MrOrange963
- Repo: https://github.com/MrOrange963/Stuff-from-laptop-

---

## Clone Your Files on New Laptop

After installing Git, open a terminal and run:
```
git clone https://github.com/MrOrange963/Stuff-from-laptop-.git
```

---

## Run the managed-by-marcus App

After cloning, open a terminal in the `managed-by-marcus` folder and run:
```
npm install
npm run dev
```
Then open your browser to http://localhost:5173

---

## Run the Main HTML Tool (index.html)

No install needed — just open `index.html` directly in your browser.
