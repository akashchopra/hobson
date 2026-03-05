# Getting Started
Hobson is a live programming environment inspired by [Smalltalk](https://en.wikipedia.org/wiki/Smalltalk), [Lisp](https://en.wikipedia.org/wiki/Lisp_(programming_language)), Mel Conway's [Humane Dozen](https://melconway.com/Home/pdf/humanedozen.pdf), and most of all by Alexander Obenauer's [Itemized OS](https://alexanderobenauer.com/labnotes/).

The system aims to document itself from within, so the only way to learn more is to run the system. It consists of an HTML bootloader file that is used to import all of the system code into IndexedDB. First, download https://github.com/akashchopra/hobson/blob/master/src/items/backup.json to your machine. Then go to https://akashchopra.github.io/hobson/src/bootloader.html. You will be presented with this screen:

<img width="834" height="402" alt="image" src="https://github.com/user-attachments/assets/5e586a00-ba45-46d7-b540-6d5f2dca5ef4" />

Upload the backup.json file (which contains the full system, not just the kernel) and you are ready to go! The system should open at the "New Users" workspace, but if for some reason the backup file was configured to load a different workspace, simply press Ctrl+k and select "New Users" from the choices offered - it is the best starting point for learning about the system.

## Warning
This system is almost entirely vibe-coded, and needs serious review. The documentation within the system is also mostly AI-generated, and can sometimes read like marketing material - treat with caution!
