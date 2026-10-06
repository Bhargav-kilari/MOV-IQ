# Third-Party Attributions & Intellectual Property Notices

This document outlines the intellectual property, copyright notices, and open-source licenses of third-party assets, libraries, and datasets utilized by **MOV-IQ**.

---

## 1. Project Ownership & Core Codebase
- **Project**: MOV-IQ — Move Smarter. Get Stronger.
- **Author**: Bhargav Kilari ([@Bhargav-kilari](https://github.com/Bhargav-kilari))
- **Primary License**: [MIT License](LICENSE)

---

## 2. Exercise Database & Metadata
- **Source**: [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) by Hasan Eydlrm
- **License**: MIT License
- **Scope**: Exercise names, target muscle groups, category classifications, equipment types, and multi-lingual instruction text.
- **Notice**: Used in accordance with the upstream MIT License permissions.

---

## 3. Exercise Demonstration Visuals & Media Provenance
- **Original Media & Copyright**: &copy; **Gym Visual** ([https://gymvisual.com/](https://gymvisual.com/))
- **Important Copyright & Licensing Boundaries**:
  - All exercise animations, demonstration GIFs, anatomical illustrations, and thumbnail visuals referenced or rendered in the application are the exclusive intellectual property and copyright of **Gym Visual**.
  - MOV-IQ does **not** claim ownership, authorship, or exclusive rights over any Gym Visual artwork or media.
  - Exercise media is **not** licensed under the project's MIT License.
  - MOV-IQ does not re-encode, alter, watermark, or resell Gym Visual media.
  - In strict compliance with fair attribution guidelines, all exercise demonstration views, technique modals, and exercise selection drawers retain the mandatory copyright attribution:
    > **© Gym visual — https://gymvisual.com/**

---

## 4. Deep Learning & Computer Vision
- **MediaPipe Pose (BlazePose)**:
  - Copyright: Google LLC
  - License: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
  - Usage: Client-side real-time 33-point human landmark extraction for kinematic joint angle calculation and rep tracking.
- **PyTorch**:
  - Copyright: The Linux Foundation / Meta AI
  - License: [BSD 3-Clause License](https://github.com/pytorch/pytorch/blob/main/LICENSE)
  - Usage: Standalone Python inference microservice powering the multi-task BiLSTM temporal sequence model.

---

## 5. Web Frameworks & Libraries
The following open-source dependencies are utilized under their respective licenses:

| Library / Tool | Primary Author / Maintainer | License |
| :--- | :--- | :--- |
| **React** | Meta Platforms, Inc. | MIT |
| **Vite** | Evan You & Vite Contributors | MIT |
| **Tailwind CSS** | Tailwind Labs, Inc. | MIT |
| **Lucide Icons** | Lucide Contributors | ISC / MIT |
| **Recharts** | Recharts Group | MIT |
| **Three.js / React Three Fiber** | Mr.doob / Poimandres | MIT |
| **Express.js** | OpenJS Foundation | MIT |
| **node-postgres (`pg`)** | Brian Carlson | MIT |
| **PostgreSQL** | PostgreSQL Global Development Group | PostgreSQL License |
| **NumPy & SciPy** | NumPy & SciPy Developers | BSD 3-Clause |

---

## 6. Disclaimer & Fair Use Notice
MOV-IQ is developed for educational, athletic tracking, and personal workout logging purposes. All trademarks, service marks, trade names, and logos referenced within this repository belong to their respective owners. If you are a copyright holder and believe any material has been cited or included incorrectly, please submit an issue or contact the repository owner for immediate resolution.
