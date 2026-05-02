## Open Access

```
© The Author(s) 2025. Open Access This article is licensed under a Creative Commons Attribution 4.0 International License, which permits
use, sharing, adaptation, distribution and reproduction in any medium or format, as long as you give appropriate credit to the original
author(s) and the source, provide a link to the Creative Commons licence, and indicate if changes were made. The images or other third
party material in this article are included in the article’s Creative Commons licence, unless indicated otherwise in a credit line to the mate-
rial. If material is not included in the article’s Creative Commons licence and your intended use is not permitted by statutory regulation or
exceeds the permitted use, you will need to obtain permission directly from the copyright holder. To view a copy of this licence, visit http://
creativecommons.org/licenses/by/4.0/.
```
## SURVEY

Elgammal et al. Journal of Big Data (2025) 12:

### https://doi.org/10.1186/s40537-025-01280-w Journal of Big Data

# Digital twins in healthcare: a review

# of AI-powered practical applications

# across health domains

#### Ziad Elgammal^1 , M. Taleb Albrijawi^4 and Reda Alhajj1,2,3*

```
Abstract
This review examines the evolving role of digital twins (DTs) in healthcare and how arti-
ficial intelligence (AI) is shaping personalized medicine across various medical fields.
Digital twins are virtual models that mirror individual patient profiles, making it pos-
sible to customize treatments and predict health outcomes more accurately. Through
a refined selection process, we have identified 17 distinct applications of this technol-
ogy in the past four years, each offering significant contributions to AI-driven health-
care innovation. This review highlights the progress of AI-powered digital twins in areas
such as heart health, diabetic care, mental wellness, respiratory health, and stress man-
agement. To support reader understanding and accessibility, we present intuitive visu-
als that break down complex processes, aiming to give a clear view of AI’s expanding
potential to reshape healthcare toward more proactive and patient-specific outcomes.
Keywords: Digital twins, Healthcare, Personalized medicine, AI-driven digital twin
applications, Generative models for digital twins, LLMs for digital twins, Medical digital
twins, Virtual organs, Diabetes management, Stress management, Digital patient
avatars, Virtual patient modeling, Heart digital twin, Mental health, Patient trajectory
forecasting, Virtual clinical trials
```
```
Introduction
Within the broad landscape of modern medicine, the quest to tailor treatments to the
unique needs of each patient has never been more crucial [1, 2]. As the complexity of
diseases and the volume of medical data expand [3, 4], innovative approaches are essen-
tial to navigate this intricate landscape. Picture a world where every patient’s journey
through illness is not just a series of treatments and outcomes but a dynamic, interactive
simulation that mirrors their individual experience. This is not the stuff of science fiction
but the promise of digital twins in healthcare. By creating virtual replicas of patients’
digital twins, scientists and doctors can explore and predict the effects of various treat-
ments in a controlled, risk-free environment.
As cancer rates soar globally, with millions of new cases each year [5, 6], the pressure
to find more effective, personalized treatment options intensifies. At the same time,
the emergence of new diseases, the rise of chronic conditions, and the ongoing threat
```
*Correspondence:
alhajj@ucalgary.ca

(^1) Department of Computer
Engineering, Istanbul Medipol
University, Istanbul, Turkey 2
Department of Computer
Science, University of Calgary,
Calgary, AB, Canada 3
Department of Health
Informatics, University
of Southern Denmark, Odense,
Denmark 4
Department of Biomedical
Engineering and Bioinformatics,
Istanbul Medipol University,
Istanbul, Turkey


of new viruses further complicate the healthcare landscape. The COVID-19 pandemic,
in particular, has underscored the critical need for resilient health systems capable of
addressing these multifaceted challenges [7]. Traditional methods, while foundational,
often fall short in capturing the nuanced and evolving nature of diseases such as cancer.
Enter the digital twin, a sophisticated tool that allows clinicians to simulate and analyze
a patient’s potential responses to different therapies in real-time. The idea of a digital
twin in healthcare extends beyond mere simulation; it involves a comprehensive digi-
tal representation of an individual’s biological and medical status [8]. By integrating vast
amounts of data ranging from clinical records, medical images to genomic sequences,
digital twins offer a way to personalize treatment and improve outcomes. This approach
not only promises to enhance the precision of cancer care but also to reduce the over-
all cost and complexity of treatment [9]. In this evolving field, digital twins are poised
to transform how we approach healthcare. By leveraging advanced technologies such
as artificial intelligence (AI) and machine learning (ML), these virtual models provide
a deeper understanding of each patient’s unique disease profile and treatment response.
As we move forward, the potential to revolutionize patient care and achieve unprece-
dented levels of personalization in treatment becomes ever more attainable.

**Overview**
The roots of digital twins lie in the world of engineering, where the idea first emerged
[10]. Engineers used digital models to simulate physical objects such as airplane engines
or industrial machinery, allowing for real-time monitoring and predictive mainte-
nance [11]. This approach was revolutionary, allowing issues to be detected before they
occurred. At the core of a digital twin is a dynamic feedback loop that connects a physi-
cal entity such as a patient, organ, or physiological process with a digital counterpart
that continuously evolves to reflect the real-world state of that entity. This connection is
established through bi-directional data flow, allowing the digital twin to ingest real-time
sensor data, clinical records, imaging, and lab results. And, in turn, simulate scenarios,
forecast outcomes, and recommend interventions. As shown in Fig. 1 The underlying
architecture typically consists of three main components: (1) the physical system, (2) a
virtual model that simulates the physical counterpart using statistical, mechanistic, or
AI-based methods, and (3) a data connection that synchronizes both. Over time, the
concept of digital twins began to gain traction in healthcare, driven by advances in data
science and computational power. Researchers and practitioners recognized the poten-
tial to apply this technology to human health, envisioning digital replicas of patients that
could dynamically reflect their biological and physiological states [12]. The early stages
of this leap were marked by the development of more sophisticated models and simula-
tions. At this point, healthcare digital twins were largely theoretical, relying on existing
technologies such as electronic health records and genetic sequencing. The goal was to
create virtual models that could provide personalized insights and predict health out-
comes with greater accuracy. Building on the engineering success of digital twins, the
concept matured and found widespread utility across various sectors [13], particularly
in aviation. In the 1970  s, NASA used mirrored systems for spacecraft monitoring and
simulation [14]. An example is the Apollo program, where an identical space capsule was
kept on Earth to simulate the behavior of the capsule in space [15]. This physical replica,


while useful, faced limitations due to constraints in data interchange and synchroniza-
tion. The concept of digital twins continued to evolve, leading to NASA’s definition of
digital twins in 2010 [16]. This definition underscored their potential to simulate and
mimic the entire lifecycle of complex systems. In the context of autonomous systems,
digital twins offer a powerful framework for simulating the behavior of vehicles, predict-
ing potential failures, and optimizing system performance. By creating a virtual coun-
terpart of an autonomous vehicle [17, 18], engineers can test various driving scenarios,
ensure safety compliance, and refine decision-making algorithms in real time. This
integration plays a pivotal role in improving the resiliency and security of self-driving
vehicles, ensuring safer transportation environments for both passengers and pedes-
trians [19]. As data-driven vehicles continue to evolve, digital twins will be indispen-
sable in enhancing the design, operation, and safety of autonomous vehicles in smart
transportation networks [20]. Another critical application of digital twins (DTs) is in
automated pharmaceutical laboratories [21]. In Quality Control (QC) labs, the complex-
ity of workflows and simultaneous testing of drug samples necessitates a high degree
of efficiency and precision. By integrating digital twins into Cyber-Physical Production
Systems (CPPS), pharmaceutical labs can simulate and optimize their workflows, reduc-
ing human error and improving overall productivity [22]. The relentless advancement
of artificial intelligence, Big Data, and Internet of Things (IoT) technologies has further
propelled the evolution and adoption of digital twins across various domains. In health-
care, this integration has led to the development of more detailed and dynamic virtual
models of patients. By leveraging vast amounts of data, including genetic information
and real-time health monitoring, digital twins in healthcare can provide highly person-
alized insights and predict health outcomes with greater accuracy. The transition from
theoretical models to practical applications has been noticed by significant progress

```
Fig. 1 Conceptual representation of the standard architecture of a digital twin system, illustrating the
integration of real-time data, computational modeling, visualization, and recommended action
```

in developing digital representations of individual patients. These models promise to
enhance personalized medicine by enabling more tailored and effective medical inter-
ventions. As the technology continues to advance, the potential applications of digi-
tal twins in healthcare are expanding, offering new possibilities for preventative care,
human enhancement, and optimized treatment strategies. The history of digital twins in
healthcare reflects a remarkable journey from engineering origins to their current role
in personalized medicine. From their early applications in engineering to their evolution
and widespread use in various sectors, digital twins have transformed how we under-
stand and manage complex systems. As the technology continues to advance, it will be
crucial to address the associated ethical and social challenges, ensuring that the benefits
of digital twins are realized while mitigating potential risks.
The primary goal of this review is to explore the current landscape of digital twin
applications in healthcare, with a specific focus on how AI-driven technologies are
transforming personalized medicine across various medical fields. We review real-world
implementations where patient data has been utilized effectively.
We apply strict criteria for inclusion: each study must provide a concrete example of
DT technology applied in practice, utilizing specific datasets to achieve measurable out-
comes. By concentrating on these cases, this review aims to identify emerging trends in
healthcare DT applications, highlighting clear results and the practical potential of DTs
in advancing personalized medicine. Through this approach, we seek to provide insights
into how DTs are evolving from theoretical concepts into tangible tools for enhancing
healthcare.

**Methodology**
In this section, we describe the process of selecting and extracting articles to address our
research objectives.
Figure 2 shows the flow diagram used to outline the process of identifying and select-
ing studies. We started by searching databases with a refined query to gather articles.
After removing duplicates, we screened the remaining articles by checking the titles and
abstracts to see if they were relevant. Next, we reviewed the full text of each selected
article, excluding those that did not fit our research question. This process gave us a final
set of 17 studies to analyze.

**Article collection process**
To identify the main trends in the use of Digital Twins (DTs) in healthcare, we conducted
a targeted search of peer-reviewed articles from two prominent academic databases,
Web of Science [23] and Scopus [24]. The search strategy was designed and refined to
ensure it captures studies most relevant to our specific research focus. Table 1 outlines
the specific optimized queries we applied to both databases. We also applied consistent
filters across both databases: only articles published in English were included, and all
peer-reviewed formats (including journal articles, conference papers, and reviews) were
considered. These filters were applied in conjunction with the search queries detailed in
Table 1 to ensure relevance and methodological consistency. The resulting articles span
the period from 2019 to 2024, reflecting the most recent developments in the field. In
total, we retrieved 206 articles. This number includes 44 from Web of Science, 77 from


Scopus, and 85 articles that were manually selected from Google Scholar. These manu-
ally chosen studies were included because they were identified as highly relevant to our
research focus but were not captured by the database queries. After compiling the initial

```
Fig. 2 The process of article identification, screening, exclusions, and final inclusion from database searches
```
**Table 1** Queries used for extracting articles from Scopus and Web of Science databases

**Query source Query term Number
of
results**

Web of Science ((((((ALL=(Digital twins)) AND TS=(Healthcare)) AND TS=(AI
OR “artificial intelligence” OR “generative AI” OR “large lan-
guage models”)) AND LA=(English)) NOT ALL=(blockchain))
NOT ALL=(metaverse))

```
44
```
Scopus (TITLE (“Digital twins”) AND TITLE-ABS-KEY (healthcare) AND
TITLE-ABS-KEY (“AI” OR “artificial intelligence” OR “generative
AI” OR “large language models”) AND NOT TITLE-ABS-KEY
(blockchain) AND NOT TITLE-ABS-KEY (metaverse) AND NOT
TITLE-ABS-KEY (“Internet of Things” OR iot)) AND (LIMIT-TO
(LANGUAGE, “English”))

```
77
```

set of 206 articles, we systematically removed duplicates, resulting in a final count of 190
unique articles.

**Initial screening process**
We began with an initial screening of titles and abstracts to assess each article’s rele-
vance to our research. This step helped us ensure that selected articles focused on our
main question and core themes, including digital twins, healthcare, and AI. Articles
were excluded if they did not meet the following criteria:

- Out of Scope: Studies focusing on digital twins in unrelated fields like cybersecurity,
    smart homes, cities, or communication systems were removed.
- Irrelevant Topic: Articles that did not clearly address Digital Twins or lacked suffi-
    cient application within healthcare were excluded.
- Non-healthcare Focus: Studies not related to healthcare were removed from further
    consideration.
- Meta-analyses and Reviews: Systematic reviews, surveys, and meta-analyses were
    excluded.
- Unavailable Articles: We excluded papers where the abstract or full text was inacces-
    sible.

After this initial screening process, a total of 114 articles were excluded, leaving 76 arti-
cles that moved on to the full-text screening phase.

**Full‑text screening**
For the remaining articles, we carefully conducted a thorough full-text review to ensure
alignment with our research purposes. In this process, we aimed to guarantee the rel-
evance and quality of the selected articles by addressing specific research questions that
informed our evaluation criteria. The first criterion assessed whether the articles pre-
sented a direct application of digital twins in healthcare or if they were predominantly
theoretical. Articles demonstrating practical applications were included in our review,
while those that lacked real-world applicability were excluded. We also identified the
specific healthcare domains in which digital twins were applied, such as chronic dis-
eases, cancer, diabetes, cardiovascular diseases, and stress management.
Another essential aspect of our screening involved evaluating whether the applications
of digital twins incorporated artificial intelligence, machine learning, or any form of
intelligent algorithm or tool. Articles that clearly integrated AI into their methodologies
were included, whereas those lacking this integration were excluded. We catalogued the
types of AI models employed within the articles, such as machine learning algorithms,
generative AI techniques, large language models (LLMs) and graph theory, providing
insight into the diverse applications of AI in the field.
Data utilization played a significant role in our screening process. We prioritized
articles that explicitly defined and utilized datasets, including them in our review.
Conversely, articles that did not clarify their datasets, mentioned only general DT devel-
opment, or could not be retrieved were excluded. We also assessed the role of data inte-
gration in enabling practical applications.


This systematic approach Helped retain only the articles that directly answered our
research question and met our specific criteria for analysis. This thorough screening is
crucial to our review, enabling us to gather valuable insights on the role of digital twins
and AI in Healthcare. After completing the full-text review, we identified 17 articles that
will be examined to address our research questions. Figure 3 shows the steps taken dur-
ing the full-text screening process.

**Digital twins applications across multiple medical domains**
In this section, we organized our review into focused subsections, grouping related
studies under clear headings. For example, applications of digital twins in cardiac care
are collectively presented under the subsection Simulating the Heart: digital twins for
Precision Cardiac Care, which includes several studies on Heart-focused digital twin

```
Fig. 3 Visual guide illustrating the full-text screening process, including rules for article inclusion and
exclusion
```

technologies. Table 1 in Supplementary data brings together all the studies reviewed in
this paper, listing the year, authors, application domain, and outcomes, providing a quick
overview of focus and impact of each study on healthcare.
Table 2 lists the available performance metrics for some studies; metrics vary between
papers and are omitted when not reported. For complete results, please refer to the orig-
inal publications.

**Simulating the heart: digital twins for precision cardiac care**
One such example proposed by Rouhollahi et al., which addressed the challenge of aortic
stenosis (AS) [37], a common heart valve disease predominantly affecting the elderly,
where the narrowing of the aortic valve due to calcification complicates treatment plan-
ning [25]. Particularly, procedures like transcatheter aortic valve replacement (TAVR)
[38] require precise anatomical understanding. Traditional methods of generating
patient-specific digital replicas for surgical planning are time-consuming, complex and
require expertise. To overcome this, the study introduces CardioVision, an AI-driven
tool designed to automatically generate digital twins of AS patients using deep learning
techniques. CardioVision automates computed tomography (CT) image segmentation
and reconstructs 3D models of the aortic valve, offering a highly detailed view of the
valve and surrounding structures. These digital twins allow clinicians to simulate surgi-
cal procedures like TAVR, predict complications, and personalize prosthetic selection,

**Table 2** Summary of reviewed studies and their reported performance metrics

**Authors Application Performance metric(s) reported**

Rouhollahi et al. [25] Cardiac care IoU: 95.6%, Dice score: 97.8%
Dervisoglu et al. [26] Cardiac care Model: LR + Binning + chi2; accuracy: 0.86; recall: 0.98;
F-score: 0.92. Detailed results in Table 1 of the original
work
Shamanna et al. [27] Diabetes Diabetes-related tests performed. Detailed results in
Tables 1 and 2 of the original study
Abirami et al. [28] Mental health DS1: accuracy: 97.95%, F1-score: 0.98, MCC: 0.93675; DS2:
accuracy: 91.48%, F1-score: 0.91, MCC: 0.79816. Detailed
results in Table 3 of original work
Abilkaiyrkyzy et al. [29] Mental health Accuracy: 69%, Acceptability and usability score: 84.75%.
Full results in Tables 4–6 of the original work
Sarp et al. [30] Chronic wound management MSE: 25.
Avanzato et al. [31] Lung health Accuracy: 96.8%; precision: 92%; recall: 97%; F1-score:
94%
Kolekar et al. [32] Lung cancer BSC: C-index = 0.97; LCSA: C-index = 0.82; Rapid
response—F1: 0.65, sensitivity: 0.77, AUROC: 0.84,
AUPRC: 0.
Kumi et al. [33] Stress management MAE: 3.3988; MAPE: 4.6020; RMSE: 4.4702; R^2 : 0.
Wang et al. [34] Clinical trials Pearson r: up to 1.0; AUROC: 0.821; Presence disclosure
sensitivity: 20%; Attribute disclosure sensitivity:< 0.25;
NNAA score: 0.
Marakov et al. [35] Patient Health NSCLC: MAE = 0.55 ± 0.04 ( ↑3.4%), R^2 = 0.98; ICU: MAE =
0.59 ± 0.03 ( ↑1.3%), R^2 = 0.
Moore et al. [36] Oncology AUROC: 0.864 (95% CI: 0.857–0.872) with SynTwin; base-
line AUROC: 0.791 (95% CI: 0.781–0.800) with real data


ultimately optimizing patient-specific treatment strategies. The digital twin develop-
ment uses the U-Net deep learning architecture to segment CT scans and reconstruct
patient-specific geometries, focusing on calcification a critical factor in AS progression.
By utilizing 35 CT scans, the input data were raw images, while the output was a highly
accurate 3D digital twin. This model aids in visualizing calcification distribution, which
directly impacts valve function and the success of interventions like TAVR. The evalu-
ation of CardioVision showed a high accuracy rate, with metrics such as an Intersec-
tion over Union (IoU) [39] of 95.6% and a Dice Score of 97.8%. These reconstructions
enhance pre-surgical planning and prosthetic device fitting, leading to personalized care
and reduced complications. Lwin, T.C. et  al. shifted the focus from adult heart disease
to fetal heart monitoring, leveraging digital twin technology to improve fetal heart rate
(FHR) monitoring [40] during labor [41]. Fetal heart rate variability (FHRV) [42] is a
crucial indicator of fetal well-being, helping predict complications and assess potential
long-term risks, such as non-communicable diseases (NCDs). The team created a digital
twin to simulate the fetal heart’s real-time behavior during labor, enabling better moni-
toring and prediction of fetal outcomes. To enhance the accuracy of this digital twin,
the system integrates three entropy measures [43]: Shannon, Approximate, and Sample
Entropy to assess the complexity of the fetal Heart rate. These measures Helped create a
more detailed and predictive virtual model of fetal heart rate dynamics. The study ana-
lyzed 585 fetal electrocardiogram (ECG) recordings collected via scalp electrodes during
labor in Japan. By processing this data, the digital twin provided real-time simulations of
fetal health, focusing on key indicators such as umbilical cord blood gas parameters [44]
(bicarbonate and base excess). These parameters are critical for ensuring fetal well-being
and informing medical interventions. By accurately correlating entropy measures with
blood gas data, the digital twin system was able to anticipate potential complications,
providing early warnings to clinicians. This proactive system highlights the potential of
digital twins in enhancing prenatal care through personalized monitoring. Dervisoglu,
H. et  al. tackled the critical need for continuous monitoring and timely intervention in
cardiovascular diseases (CVD), a leading global cause of death [26]. The study compared
two digital twin frameworks, cloud-based and edge-based, to evaluate their effectiveness
in real-time prediction and monitoring of heart disease in patients. Both frameworks
were designed to predict heart disease using ECG data and to send real-time alerts when
abnormalities were detected. The digital twin technology allowed for real-time virtual
representation of patient heart health, enabling early detection and timely interventions.
The cloud-based framework leveraged centralized data storage and historical analysis,
while the edge-based framework used local processing for real-time analysis, reducing
latency. The study utilized the PTB Diagnostic ECG Database [45], which includes 549
ECG records from 290 patients (healthy and cardiac). Each record contained 15 ECG
signals, processed through both cloud and edge frameworks. The edge-based frame-
work showed lower latency (10.6 ms) compared to the cloud system (18.8 ms), making
it more suitable for real-time cardiac monitoring. In terms of accuracy, both systems
performed well, with the Logistic Regression [46] model achieving 86% accuracy and
98% recall. The Gradient Boosted Tree model [47] demonstrated the highest precision
at 92%. These findings suggest that edge-based systems are better suited for real-time
monitoring, while cloud-based systems offer greater scalability for larger datasets. Both


frameworks hold significant potential for improving early detection and management of
heart disease. We noticed that most of the studies rely on relatively small datasets, rais-
ing concerns about their scalability and performance across diverse patient populations.
Addressing this challenge will be crucial to ensuring that digital twin technology can
be effectively and reliably implemented in heart disease management on a larger scale
(Fig. 4).

**Diabetes management through digital twin technology**
One of the most significant applications of digital twin technology is its use in diabe-
tes management [48, 49]. Diabetes is a chronic condition that requires constant moni-
toring and precise adjustments in treatment based on individual patient responses to
factors such as diet, physical activity, and insulin levels. Traditional methods often fall
short in capturing the complexity and variability of each patient’s condition, leading
to challenges in maintaining optimal blood glucose levels. In this section, we provide

```
Fig. 4 Overview of digital twin applications for heart-related studies, illustrating the workflows for optimizing
surgical outcomes in aortic stenosis, real-time fetal heart rate (FHR) monitoring, and predictive heart disease
models using cloud-based and edge-based DT frameworks. Each section highlights the key steps from data
acquisition to prediction, demonstrating the role of digital twins in enhancing heart health management
```

a review of different applications. Figure 5 represents the application of digital twin
technology in managing both Type 1 and Type 2 diabetes, as demonstrated in two
studies. These studies highlight how digital twins are being leveraged to personal-
ize treatment and improve outcomes by providing real-time, data-driven insights for
insulin therapy and nutrition optimization.
Cappon et  al. introduced the TWIN system, a digital twin-based clinical decision
support system (DSS) designed to enhance the management of Type 1 diabetes (T1D)
in pediatric patients [50]. Managing T1D [51], poses significant challenges due to the
constant need to balance evolving physiological needs and maintain stable blood glu-
cose levels. The standard approach of multiple daily insulin injections (MDI) requires
precise dosage adjustments based on a variety of factors, such as diet, physical activ-
ity, and patient behavior, making diabetes management labor-intensive and error-
prone. To address these challenges, the TWIN system integrates continuous glucose
monitoring (CGM) devices, smart insulin pens, and physical activity trackers to auto-
mate the collection of real-time patient data. The digital twin technology creates a

```
Fig. 5 Illustration of digital twin frameworks for Type 1 and Type 2 diabetes management. For Type 1
diabetes, the system integrates real-time glucose monitoring, insulin administration records, and physical
activity data to optimise insulin therapy through continuous data processing and prediction. For Type 2
diabetes, a machine learning-based digital twin analyzes glucose readings, food intake, and biometric data
from 64 patients over 90 days to identify patterns, enabling precision nutrition and optimized medication
management. The figure highlights how digital twin technology tailors personalized therapy for both
conditions
```

virtual model, allowing detailed simulations of how their body responds to different
insulin dosages. This personalized approach enables healthcare providers to make
more accurate, data-driven decisions for insulin adjustments, improving treatment
efficacy.
At the core of TWIN’s digital twin generation process is the ReplayBG algorithm, a
nonlinear model that simulates glucose concentration responses based on real-time
data. By leveraging Bayesian techniques, the system estimates physiological parameters
unique to each patient and continuously runs simulations to optimize insulin therapy,
both for shortacting and long acting insulin doses. Additionally, the system’s AI-driven
suggestion module provides healthcare providers with dosage recommendations,
explaining the reasoning behind them through a large language model similar to Gen-
erative Pre-trained Transformer (GPT). The TWIN system significantly reduces manual
data entry for patients and caregivers while ensuring a high level of accuracy in ther-
apy recommendations. Real world data from CGM devices, insulin administration logs,
and physical activity trackers are fully integrated into the system to deliver optimized
insulin therapy parameters. The system’s outputs include personalized adjustments for
carbohydrate to insulin ratios, correction factors, and basal insulin doses, all explained
with context for clinicians. Results from the study indicate that the TWIN system greatly
improves the personalization of diabetes management by maintaining blood glucose lev-
els within the target range for longer periods, reducing manual input and automating the
critical aspects of diabetes care. However, the system’s dependence on data quality from
devices and its adaptability to a broader patient population need further development
to ensure scalability and reliability. The TWIN system offers an innovative solution for
pediatric diabetes management, using AI-driven digital twins to provide real-time, per-
sonalized recommendations that lighten the burden on patients and caregivers.
Another digital twin system introduced by Shamanna, P. et  al. which investigated
the use of digital twin technology enabled precision nutrition (TPN) for the manage-
ment of Type 2 diabetes (T2D), focusing on reducing hemoglobin A1c (HbA1c) levels
and minimizing the reliance on diabetes medications [27]. The researchers conducted a
90-day retrospective analysis involving patients with T2D who participated in the TPN
Program. The system integrates CGM device data, food intake logs, and biometric data
to provide personalized nutritional guidance, targeting postprandial glycemic responses
(PPGR) [52]. Digital twins utilized to create virtual models of each patient’s metabolic
processes, enabling individualized nutrition recommendations. The system’s machine
learning model continuously refines its predictions based on real-time glucose readings
and dietary habits, allowing the digital twin to deliver increasingly accurate advice on
dietary Choices that minimize blood glucose spikes. After 90 days, patients in the TPN
Program experienced notable improvements: HbA1c levels decreased from 8.8% to 6.9%,
and insulin resistance decreased by 56.9%. Many patients were able to reduce or discon-
tinue their diabetes medications, highlighting the program’s effectiveness in improving
glycemic control through precision nutrition. However, the reliance on patient reported
food intake data introduces potential inaccuracies that could affect the precision of the
digital twin’s recommendations. Still, this application shows significant potential in man-
aging T2D by providing tailored nutritional guidance and reducing medication depend-
ency. However, further research with larger sample sizes and longer follow-up periods is


probably required to validate these findings and assess the long term sustainability of the
improvements.

**Digital twin applications for personalized medicine in mental health**
Following our review of digital twin applications in diabetes care, in this section we turn
to how this technology is helping in mental and neurological health. In mental health,
digital twins create dynamic, data-rich models that capture each patient’s unique mental
and emotional profile. By integrating real-time data from behavioral patterns, cognitive
markers, and physiological signals, these systems empower clinicians to anticipate chal-
lenges and design interventions adopted to each patient’s specific needs.
Figure 6 presents a clear view of how digital twin models applied across mental health
care, drawing on data from wearables, clinical assessments, and voice analytics. In the
studies that follow, we examine their impact on migraines, dementia, Parkinson’s, and
depression, revealing how digital twins unlock new possibilities for real-time, individual-
ized care.
Gazerani [53] Migraines are a recurring neurological disorder characterized by intense
headaches and sensory disturbances, influenced by genetic, environmental, and lifestyle
factors, making treatment complex and highly individualized [54]. Gazerani et  al., in
their study, proposed the use of intelligent digital twins for personalized migraine care.
These digital twins create a virtual model of the patient, allowing for dynamic simula-
tions that reflect individual symptoms, triggers, and responses to treatment. Key bio-
markers, such as miRNAs (e.g., miR-34a, miR-382, miR-155) [55], have emerged as
critical indicators for diagnosing and managing migraines. The authors proposed a

```
Fig. 6 Visualizing digital twin applications in mental and neurological healthcare. The diagram illustrates
how various data sources, including wearable devices, clinical inputs, and voice recordings, contribute to
digital twin systems, enabling personalised care. Applications include predicting migraines and adjusting
treatments, constructing personalized digital twins for dementia care based on matched cases, detecting
Parkinson’s disease through voice analysis, and evaluating depression severity via conversational AI.
These systems, powered by machine learning algorithms, enable personalized and proactive healthcare
interventions
```

framework where the developed digital twin can leverage machine learning algorithms
to analyze real-time data from wearable devices like the Empatica E4, which tracks
biosignals such as heart rate, skin temperature, and electrodermal activity. This data is
integrated with clinical information from the REFORM (Registry for Migraine Study)
[56], which gathers biological markers, brain imaging, and treatment outcomes to iden-
tify predictive biomarkers, particularly for treatments like erenumab [57]. By refining the
understanding of each patient’s unique migraine triggers, the digital twin helps clinicians
predict the onset of migraine attacks and adjust treatment strategies. The system simu-
lates physiological responses, enabling personalized forecasting of symptoms and safer
treatment adjustments, including simulations of drug interactions to reduce the risk of
medication overuse.
Continuing from the work done in migraine care, another promising area for digi-
tal twin technology lies in dementia management. Dementia, a progressive neurologi-
cal disorder marked by cognitive decline and memory loss, presents unique challenges
in treatment due to the wide variability in symptom progression and patient responses
[58]. Wickramasinghe et al. in their proposed Perspective, a digital twin application as a
decision support system (DSS) for dementia care, accessible via mobile, tablet, or desk-
top [59]. Clinicians or carers input patient data (e.g., risk factors, symptoms, treatments)
into the DSS, which connects to a remote server running a machine learning or deep
learning algorithm. The algorithm retrieves similar cases from a dementia data reposi-
tory containing rich data from an extensive cohort of dementia cases and constructs a
digital twin by combining the best-matching cases. If no exact match is found, a similar-
ity score is provided. This digital twin enables clinicians to make informed and personal-
ized decisions regarding diagnosis and treatment planning. Since this is a perspective
piece, the authors have not explored specific AI models or datasets that might underpin
the development of a digital twin application. Although it doesn’t showcase a real-world
implementation, we included it as an insightful conceptual framework, offering a foun-
dational approach for designing digital twin applications in healthcare with promising
implications for personalized dementia care.
Expanding the potential of digital twins beyond dementia care, another study by Abi-
rami et al. explores the use of this technology for early detection of Parkinson’s disease
[28]. The system constructs a patient-specific digital twin by analyzing voice recordings
collected via smartphones or other devices. These recordings track vocal biomarkers
associated with Parkinson’s, such as vocal tremors and speech impairments, which are
indicators of the disease’s progression. The study utilized two datasets: DS1, consist-
ing of voice data from 195 subjects (147 with Parkinson’s, 48 healthy controls) collected
from Kaggle Cerrahpasa Faculty of Medicine, Istanbul University repository [60], and
DS2, from Oxford University [61]. The voice recordings were gathered using standard
protocols to assess Parkinson’s-related vocal impairments. Important vocal features were
extracted from the recordings and processed by the core model, an Optimized Fuzzy-
Based k-Nearest Neighbour (OF-kNN) classifier. This model was specifically chosen to
handle the variability in voice data and offer more precise classifications of early Parkin-
son’s symptoms. The OF-kNN classifier uses fuzzy logic to manage uncertainties in vocal
feature measurements, enabling more refined detection of subtle changes in vocal bio-
markers. This digital twin system allows clinicians to identify early signs of Parkinson’s


disease and tailor treatments based on individual patient profiles. Its reliance on voice
data makes it highly accessible and scalable for remote, continuous monitoring. The inte-
gration of the OF-kNN model within the digital twin framework highlights a forward
thinking approach to personalized care, offering a more accurate and proactive method
for early diagnosis and intervention in neurodegenerative diseases like Parkinson’s.
Following the application of digital twins for early Parkinson’s detection, a different
approach extends the technology into the area of mental health. Abilkaiyrkyzy, A. et al.
In their study, digital twins are adapted to assess depression through conversational AI
[29]. With the help of natural language processing (NLP) techniques, this system cre-
ates a dynamic model of the user’s mental state, engaging them in real-time dialogue to
detect early signs of mental illness. Using a fine-tuned bidirectional encoder represen-
tation from transformers (BERT) [62] model trained on the Extended Distress Analy-
sis Interview Corpus (E-DAIC) [63], which contains clinical interview transcripts, the
system processes user responses, identifying the severity of depression from the con-
versation. The chatbot categorizes responses into different levels of depression severity,
such as no symptoms, mild, or moderate/severe, providing personalized mental health
insights. As users interact, their inputs help build a “digital twin” of their mental health,
continuously refining the system’s ability to predict their condition based on ongoing
conversations.
The system was tested on the E-DAIC dataset and real-world participants, achiev-
ing an accuracy of 69% and demonstrating high usability. This system represents a sig-
nificant advancement in AI-driven mental health screening, enabling early detection
through everyday dialogue.
As we have seen, digital twins are helping to address various mental health disorders,
particularly conditions like depression and neurodegenerative diseases. Yet, challenges
remain, including safeguarding data privacy, ensuring quality input, and smoothly inte-
grating these systems into healthcare. Despite these hurdles, digital twins hold remarka-
ble potential to expand care options across mental health and chronic diseases. Machine
learning drives this progress, with its ability to analyze complex data and produce tar-
geted insights. We expect a high impact of digital twins in the coming future, relying on
continued advancements in machine learning.

**Different practical implementations of digital twins across healthcare domains**
Moving beyond the specialized focus areas like diabetes, cardiac care, and mental health,
digital twins have recently expanded into a wider range of healthcare applications. These
developments overcome practical, everyday health challenges, offering new ways to
improve patient outcomes. Figure 7 provides a visual summary of different digital twin
applications within healthcare, showing the distinct processes and outcomes for each
use case across different medical challenges.
Sarp et al. developed a digital twin framework designed specifically for chronic wound
management, addressing a critical need for monitoring and personalized treatment in
wound care [30]. Chronic wounds, often slow to heal and challenging to manage, require
continuous assessment and adjustment of treatment strategies [64]. This study intro-
duces an innovative approach that allows clinicians to visualize and predict the healing
process of chronic wounds using digital twin technology.


The developed framework uses machine learning models to simulate the progression
of wound healing. By creating a virtual replica of the patient’s wound, the system ena-
bles healthcare providers to monitor changes, assess the effectiveness of treatments, and
anticipate potential complications. The key advantage lies in its ability to offer personal-
ized insights into the healing process, allowing clinicians to make data-driven decisions
on whether to continue or adjust a treatment plan. To achieve this, the authors employed
a generative adversarial network (GAN) [65] as the core model. GANs are well-suited
for generating realistic future outcomes, making them ideal for simulating wound Heal-
ing trajectories. The model was trained on a dataset of 700 paired wound images, cap-
turing the before and after conditions of various chronic wounds over time. This model
not only predicts the wound’s future state but also simulates potential healing outcomes
based on different treatment scenarios. The model operates in three stages: first, clas-
sifying the wound type; next, segmenting and classifying the wound tissues; and finally,
predicting the distribution of wound tissues over time. Testing involved comparing the
predicted tissue distribution to actual outcomes, with the model achieving significant

```
Fig. 7 Visual representation of diverse digital twin applications across the healthcare domain. This diagram
outlines the processes from data collection to real-time prediction in various areas: wound management,
lung health monitoring (Lung-DT ), social distancing management (CanTwin), and stress monitoring. Each
workflow showcases the integration of machine learning models and real-time data to enable predictive,
personalized healthcare interventions
```

accuracy in identifying non-healing wounds and predicting the overall healing process.
The data used includes a combination of wound images and patient demographic infor-
mation such as age, underlying conditions, and the wound’s medical history. This holistic
data approach allows the model to consider multiple variables influencing wound heal-
ing, making the predictions more robust and personalized. The integration of image data
with patient characteristics enhances the framework’s capacity to adapt to individual
patient needs. The system’s performance was evaluated using the mean squared error
(MSE) metric, which compared predicted tissue distributions to actual results. The MSE
score of 25.84 indicated that the model accurately predicted around 74% of the wound
tissue.
This system enables remote wound monitoring and early detection of complications,
improving outcomes and reducing costs. While challenges like data privacy and broader
validation exist, this AI-powered approach offers real-time, personalized insights that
enhance patient care and treatment strategies.
Moving on to another area of respiratory health, Avanzato et al. developed Lung-DT,
a framework specifically focused on improving lung disease diagnosis and real-time
monitoring. It’s an AI-powered digital twin framework for thoracic health monitoring
and diagnosis, aimed at improving the diagnosis and management of lung diseases, par-
ticularly in the context of COVID-19 [66] and other lung-related pathologies [31]. The
framework seeks to address the growing need for timely, accurate diagnosis and continu-
ous monitoring of lung health through real-time data integration and AI-driven analysis.
The developed application provides a digital twin of the respiratory system, enabling
healthcare providers to monitor and assess lung conditions remotely. This virtual repre-
sentation integrates chest X-ray images and real-time physiological data collected from
IoT sensors, such as blood oxygen levels (SpO2), to generate predictive insights about
the patient’s lung health. The system can classify lung conditions into five distinct cat-
egories: normal, COVID-19, lung opacity, pneumonia, and tuberculosis, allowing clini-
cians to make informed decisions based on accurate, up-to-date data.
The proposed Lung-DT model relies on the YOLOv8 deep learning model [67], which
is highly effective for real-time image detection and classification tasks. YOLOv8 was
specifically trained to detect anomalies in chest X-rays, such as opacities associated with
COVID-19 or pneumonia. The model was trained using a large dataset of chest X-ray
images, spanning different lung conditions, and enriched with IoT sensor data to create a
more comprehensive view of the patient’s health. The integration of SpO2 data alongside
the image analysis allows for a more precise diagnostic tool, ensuring that the predic-
tions are grounded in multiple physiological indicators rather than just visual analysis.
The dataset used for model training consisted of thousands of labeled chest X-ray images
from public datasets, covering various lung conditions such as COVID-19, pneumo-
nia, and tuberculosis. Additionally, real-time physiological data from IoT sensors, like
SpO2 measurements, were incorporated to provide a dynamic and real-time monitoring
capability. This combination of static and dynamic data allows the system to simulate
real-world scenarios and predict disease progression more accurately. The evaluation of
the Lung-DT framework showed high performance in classifying lung conditions. The
YOLOv8 model achieved an accuracy of 93.4% in detecting anomalies in chest X-rays


across the five categories. In addition, the integration of physiological data from IoT sen-
sors further enhanced the accuracy of the system, ensuring more reliable diagnostics by
considering multiple health indicators.
The Lung-DT framework enables early detection and remote monitoring of lung
diseases, minimizing hospital visits and allowing timely interventions. By track-
ing physiological data and using predictive insights, it helps prevent severe health
declines. Though challenges like model adaptability and data privacy remain, this AI-
powered tool shows strong potential for personalized lung care.
Another important application, also focused on lung health, is the precision medi-
cine platform proposed by Kolekar et  al., which leverages AI for personalized care
strategies [32]. The web-services platform (Comp-Med) is designed to support clini-
cians in delivering highly personalized treatments by integrating AI-powered services
with patient data from multiple sources. It focuses on three core areas: predicting lung
cancer survival, analyzing lung Tumor segmentation for survival analysis, and pro-
viding rapid response care in emergencies. CompMed’s predictive power lies in two
key AI models. For lung cancer survival prediction, the system employs ResNet-
[68], a deep learning model that performs binary classification on five-year survival
rates. The integration of multi-modal data, including positron emission tomography
(PET) and computed tomography (CT) scans, enables this model to generate highly
accurate predictions. Additionally, the platform incorporates MAPTransNet [69], a
global context-aware transformer model used for lung Tumor segmentation. MAP-
TransNet plays a crucial role in identifying Tumor regions on PET images, aiding in
survival analysis and treatment planning. The datasets used to train and validate these
models are substantial. For the lung cancer prediction model, the study utilized the
LC-CNUHH dataset from Chonnam National University Hwasun Hospital, which
includes 4,591 lung cancer cases, encompassing both non-small cell lung cancer
(NSCLC) and small cell lung cancer (SCLC) patients. For the rapid response analysis,
the researchers used the RRT-CNUHH dataset, containing data from 25,329 patients,
focusing on vital signs to predict clinical deterioration in emergency settings. Model
performance was evaluated using various metrics. The lung cancer prediction model
achieved an impressive C-index of 0.97 for five-year survival classification. Tumor
segmentation accuracy was measured using the Dice score, while survival analy-
sis relied on metrics such as the Brier score, Mean Absolute Error (MAE) [70], and
Binomial Log-likelihood (IBLL). The rapid response model for emergency care dem-
onstrated strong performance with an area under the Receiver Operating Character-
istic curve (AUROC) [71] of 0.837, highlighting its ability to accurately predict patient
deterioration in real-time.
CanTwin system, developed by De Benedictis et  al. in collaboration with Hitachi
[72]. This system was designed for a canteen serving 1100 workers to monitor social
distancing, manage queues, count people, and supervise table occupancy during the
COVID-19 pandemic. The study emphasizes the growing role of digital twins in pub-
lic health to enhance safety and space management in industrial settings.
The CanTwin architecture integrates several layers, starting with the physical twin,
which mirrors the actual canteen environment, and the data collection layer, which gath-
ers real-time data from sensors and IoT devices. This information is processed and used


to update the digital twin model in real time. An analytics layer applies algorithms to
detect social distancing breaches and predict crowding, while the user interface layer
presents these insights through dashboards, enabling managers to take quick action.
Data for the system was gathered from sensors and IoT devices tracking foot traffic
and occupancy. This data was used to train and assess the system’s accuracy in detect-
ing social distancing breaches, predicting congestion, and providing real-time alerts.
Although specific quantitative results aren’t given, the paper emphasizes the system’s
effective deployment in managing crowd control and optimizing space usage in a real-
world environment.
Digital twin systems have also supported individuals facing stress-related challenges,
helping to improve their quality of life. Kumi et  al. proposed a digital twin framework
for stress management by utilizing synthetic data to predict stress management scores
based on data collected from wearables like the Google Pixel watch [33]. This system,
dubbed Digital Twin for Stress Management (DTSM), aims to address the challenges of
limited data and privacy concerns by generating high quality synthetic data to simulate
real-world conditions.
The DTSM integrates multiple synthetic data generation techniques, including Con-
ditional Tabular GAN (CTGAN) [73], Tabular Variational Autoencoder (TVAE) [73],
Gaussian Copula [74], and two Large Language Model based approaches: Realistic
Relational and Tabular Transformer (REaLTabFormer) [75] and Generation of Realistic
Tabular data (GReaT) [76]. Among these, REaLTabFormer demonstrated the highest
performance in replicating real-world data distributions, achieving a data quality score
of 93%.
The data used to build the DTSM includes heart rate variability (HRV), sleep pat-
terns, and physical activity metrics collected from two subjects wearing the Google Pixel
watch. Features such as resting heart rate, deep sleep, rapid eye movement (rem) sleep,
light sleep, and daily step counts and much more were extracted from the wearables, and
the synthetic data module modeled this dataset to generate digital twins for stress score
prediction.
After generating the synthetic data, the authors trained four machine learning mod-
els, XGBoost, Random Forest, Light Gradient Boosting Machine (LightGBM), and Tab-
Net on the synthetic data to predict stress management scores. The LightGBM model,
trained on REaLTabFormer’s synthetic data, performed the best, achieving an MAE [70]
of 3.39%, MAPE of 4.60%, and an R^2 of 0.63, demonstrating its efficacy for this task.
The results show DTSM’s potential for effective stress monitoring and prediction
through synthetic data, providing a scalable, privacy-conscious solution for stress man-
agement in healthcare.
In this section, we explored different applications spanning multiple healthcare
domains, it became clear that this technology’s adaptability extends beyond traditional
clinical settings. While these systems offer significant potential for personalized and
predictive healthcare, challenges such as model generalization, data privacy, and trans-
parency remain. Addressing these gaps will be essential for realizing the full impact of
digital twins in diverse healthcare applications.


**Integrating LLM models and graph theory in digital twins applications**
The rise of Large Language Models (LLMs) is revolutionizing digital twin applications,
especially in healthcare [35, 77]. These models address complex challenges in patient
care and research, with refined chatbots enhancing clinician interaction [78]. In the next
section, we explore three studies that integrate LLMs with unique methodologies for
healthcare, as illustrated in Fig. 8, showcasing each study’s approach and impact.
TWIN-GPT [34], developed by Wang et al., addresses the critical problem of clinical
trials being hampered by limited data and the complexity of individual patient profiles.
The proposed model leverages large language models to create personalized digital twins
for patients participating in clinical trials. These digital twins allow for more accurate
prediction of clinical trial outcomes, even in the face of limited EHR data [79]. TWIN-
GPT works by predicting patient responses to treatments based on their real-time and
historical health data. The model fine-tunes a pre-trained LLM model (ChatGPT [80]),
using clinical trial datasets, generating a virtual twin of each patient that mimics their
health trajectory and response to interventions. TWIN-GPT can also simulate counter-
factual scenarios, predicting what would happen under different treatment paths. This
capability enhances the precision of clinical trial design, potentially reducing costs and
improving safety by allowing for virtual testing before real-world application. The dataset

```
Fig. 8 Visual representation of the workflows for three advanced digital twin applications TwinGPT, DT-GPT,
and SynTwin, leveraging large language models and graph theory in healthcare. TwinGPT focuses on refining
electronic health records (EHR) through synthetic data generation and k-nearest neighbors (KNN) refinement.
DT-GPT fine-tunes biomedical LLMs to forecast clinical outcomes from NSCLC and ICU patient datasets.
SynTwin uses a network-based approach to predict patient mortality in oncology by constructing a synthetic
patient population from the SEER dataset
```

used for model training includes a Phase III breast cancer trial dataset (NCT00174655)
consisting of 2887 patients, along with the multi-modal Trial Outcome Prediction (TOP)
dataset, which comprises over 9000 clinical trials from Phase I to Phase III. The data-
set integrates drug molecule information, disease codes, and trial outcomes, providing a
robust platform for training the LLM. In terms of evaluation, TWIN-GPT outperforms
baseline models such as EVA [81], SynTEG [82], PromptEHR [83], and TWIN-VAE [84]
in several key metrics. The model achieves a high AUROC [71] score of 0.821 in pre-
dicting severe outcomes and 0.838 when using real data. For adverse event prediction,
it performs similarly to real data, with AUROC [71] scores close to 1. These results vali-
date the model’s ability to generate high-fidelity synthetic data, which closely mirrors
real clinical trial data. Moreover, As privacy is a critical concern in clinical trials, the
authors mentioned that privacy protection metrics such as presence and attribute dis-
closure were significantly lower for TWIN-GPT compared to other methods, ensuring
patient confidentiality and providing a secure framework for virtual clinical trials while
ensuring accurate patient outcome predictions.
As TWIN-GPT showcases the potential of LLM-driven digital twins in refining clini-
cal trials, DT-GPT further extends this approach into real-time clinical care by forecast-
ing patient health trajectories [35]. Developed by Marakov et  al., DT-GPT is a digital
twin model designed to enhance clinical outcome forecasting by leveraging advanced
LLMs. This model addresses a significant challenge in clinical care for accurately pre-
dicting patient health trajectories, which is often complicated by the high variability and
incomplete nature of clinical data, particularly in complex cases such as non-small cell
lung cancer (NSCLC) and intensive care unit (ICU) patients. Traditional approaches
frequently face limitations due to the need for data imputation and normalization, and
they often struggle to capture the intricate relationships among patient metrics. DT-
GPT, however, takes a different approach by utilizing the robustness of LLMs to process
raw, real-world patient data with minimal adjustments, effectively sidestepping these
limitations.
DT-GPT’s architecture is anchored in BioMistral [85], a biomedical LLM fine-tuned
specifically to enhance the model’s medical context awareness. This foundation enables
DT-GPT to operate without the need for imputation or normalization, making it par-
ticularly adept at handling fragmented and noisy clinical records. The model preserves
the intricate relationships between clinical variables, utilizing cross-variable dependen-
cies to strengthen its forecasting abilities. This capability allows DT-GPT to adaptively
learn patterns in patient data, predicting health metrics and outcomes over both short
and long-term periods.
The study utilises two substantial datasets: the first comprises long-term data from
16,496 NSCLC patients (773,607 patient-days) sourced from the Flatiron Health data-
base, while the second dataset includes 35,131 ICU patients with 1,686,288 time points
from the MIMIC-IV database. For evaluation, the authors benchmark DT-GPT against
established models such as LightGBM. The results are notable, with DT-GPT achieving
a 3.4% improvement in mean absolute error (MAE) [70] on the NSCLC dataset and a
1.3% improvement on the ICU dataset. Additionally, DT-GPT maintains high R^2 scores
(0.98 for NSCLC and 0.99 for ICU), underscoring its ability to preserve the variable rela-
tionships integral to clinical data.


A distinctive feature of DT-GPT is its zero-shot prediction capacity. This aspect
allows the model to outperform fully trained models even on variables it has not pre-
viously encountered, a significant advantage in adapting to diverse clinical scenarios.
Evaluations, including AUROC [71] and Mean Absolute Error (MAE) [70], underscore
DT-GPT’s robust performance across time, and the authors highlight an interactive
explainability feature, where clinicians can engage with the model via a chatbot inter-
face. This capability provides valuable insights into the key variables influencing patient
outcomes, reinforcing DT-GPT’s role as a practical tool for personalized, predictive
healthcare.
Moving on from applications of large language models to SynTwin [36], a graph-based
digital twin framework developed by Moore et  al., provides a digital twin application
to predict patient mortality in oncology while preserving privacy. Using the SEER data-
set with 10 million cancer cases, SynTwin generates synthetic profiles that mirror real
patient complexity.
The process begins with calculating distances between patients using metrics like
Euclidean [86], Manhattan [87], Cosine, and Gower [88], with Gower performing best
due to its flexibility with both discrete and continuous data. A network of patient nodes
is then created, filtering edges based on a percolation threshold to prevent a fully con-
nected network. Using the Multilevel algorithm, the model detects patient communities,
which serve as a foundation for generating synthetic patients. Synthetic data generation
employs three algorithms: categorical latent Gaussian process (CLGP) [89], mixture of
product of multinomials (MPoM) [90], and multi-categorical extension of a medical
generative adversarial network (MC-MedGAN) [91], each chosen for their ability to rep-
licate the statistical characteristics of the original data. Digital twins are selected from
these synthetic patients, ensuring they align closely with real patient profiles.
For mortality prediction, the model uses a nearest-neighbor approach within each
community, simulating patient-specific outcomes with improved predictive accuracy.
SynTwin achieved an AUROC [71] of 0.864 (95% CI: 0.857–0.872), significantly outper-
forming predictions made using real data alone (AUROC [71] of 0.791, 95% CI: 0.781–
0.800). These results underscore the framework’s value in precision medicine, where
privacy-conscious synthetic data solutions can enhance predictive accuracy and patient
outcome forecasting.
In closing this section, the studies we reviewed outline the practical impact of these
technologies, demonstrating their potential to enhance our quality of life in meaningful
ways.

**Ethical, regulatory, and implementation considerations**
The integration of digital twins (DTs) into healthcare systems offers exciting opportu-
nities for more personalized, predictive, and responsive care, but it also brings to the
surface a set of complex and interrelated challenges [53] that must be addressed before
these technologies can be used responsibly in clinical settings. One of the most pressing
concerns is data privacy and security [29].
DTs rely heavily on real-time streams of sensitive patient data from wearables, mobile
devices, and electronic health records, and managing this data safely becomes increas-
ingly difficult as the volume and complexity of inputs grow. In many cases, especially in


mental health applications, the risk of misinterpretation or misuse is heightened due to
the nuanced and deeply personal nature of the data.
Addressing these risks requires a combination of technical safeguards and ethical
practices. Anonymization and de-identification techniques are essential to ensure per-
sonal identifiers are removed from datasets, and the use of synthetic data, artificially
generated datasets that mimic real ones can help train and test models without exposing
actual patient information. Secure data transfer protocols, encrypted storage systems,
and access controls that give patients agency over their data use are also critical [72]. At
the infrastructure level, edge-based systems that process data locally can reduce expo-
sure by limiting transmission over networks, while explicit consent mechanisms and
limited retention periods help reinforce trust and transparency [26, 31].
Alongside these privacy measures, regulatory considerations also demand attention.
Many of the current approval processes from agencies like the Food and Drug Admin-
istration (FDA) and European Medicines Agency (EMA) are not yet well-suited to the
evolving nature of DTs, which continuously learn and adapt over time [72]. Traditional
validation frameworks assume static systems, whereas DTs require ongoing monitor-
ing and re-evaluation [53]. This creates uncertainty around how safety and effectiveness
should be measured, and when a model is considered ready for clinical use. The absence
of standardized validation protocols, limited availability of high-quality and diverse
datasets, and a lack of clear guidelines for measuring predictive uncertainty all make
regulatory approval more difficult [31]. Ethical review processes and compliance with
institutional review boards remain essential, especially when working with real patient
data.
In parallel, clinician adoption poses another major challenge. Even the most advanced
DT system cannot be effective if clinicians are hesitant to use it. A common barrier is the
lack of transparency in how model outputs are generated. Many AI-based systems func-
tion as “black boxes”, offering predictions or recommendations without explaining how
they were reached [30]. For clinicians who are trained to reason through decisions, this
lack of clarity can reduce confidence and make integration into care processes more dif-
ficult [31]. Moreover, DTs must fit within existing clinical workflows, which vary across
institutions and often rely on legacy systems. Integrating DTs with electronic health
record (EHR) platforms, ensuring stable network performance, and preparing institu-
tions for the technical demands of DT tools all require time, planning, and investment
[35]. In addition, many healthcare professionals have limited training in interpreting AI-
driven tools, and ongoing interdisciplinary collaboration between clinicians and devel-
opers is necessary to ensure usability.
To support meaningful adoption, several practical steps can be taken: design DT sys-
tems with explainability in mind so that clinicians can understand and trust the results;
align DT development with regulatory expectations from the early stages; embed DTs
into the digital infrastructure clinicians already use, such as EHR platforms; and conduct
real-world pilot studies in clinical environments to evaluate effectiveness, usability, and
trustworthiness in practice. These efforts will not only help DTs meet technical stand-
ards, but also prepare the healthcare ecosystem for their responsible and sustainable use.


**Conclusion**
This review examined how digital twin (DT) technologies are being applied across
healthcare domains, with particular attention to the role of artificial intelligence in sup-
porting these systems. These technologies reveal transformative potential from diabetes
care to cardiovascular disease management and mental health monitoring, where they
already contribute to more personalized, dynamic, and anticipatory care models by syn-
thesizing patient-specific data, simulating outcomes, and informing clinical decisions in
real time. These advancements are evidenced by the shift of DTs from theoretical con-
cepts to real-world implementations integrated into clinical workflows. Even with this
progress, these promising developments coexist with persistent limitations. Many mod-
els remain constrained by their reliance on structured, high-quality datasets that missing
universal accessibility or standardization, forcing custom solutions for each new setting
and exposing critical gaps in scalability. A disconnect remains between technical capa-
bility and practical implementation, where institutional support, clinician engagement,
and operational alignment often struggle to keep pace with technological progress. On
top of these challenges, there are still important concerns about system safety and trans-
parency, which grow more urgent as DTs increasingly guide clinical judgment. Strong
safeguards are needed for output validation, failure mode identification, and interpret-
ability, necessitating not only routine benchmarking against clinical standards but also
clear protocols for handling messy data and defining accountability boundaries between
algorithms and practitioners. At the same time, data security also remain a serious issue.
The essential fuel of digital twins high resolution, real-time patient data streams intro-
duces unprecedented vulnerabilities that threaten adoption unless countered by rigor-
ous governance, encryption, access controls, and ethical synthetic data practices capable
of preserving clinical trust. Another key feature of digital twin systems is their dynamic
architecture, unlike traditional models, a DT is designed to evolve as new information
becomes available adjusting predictions, refining simulations, and modifying recom-
mendations in response to patient changes. While this feedback loop is a core strength, it
also introduces added complexity. Systems must be built to manage continuous updates,
track versioning, and ensure that iterative learning does not compromise model consist-
ency or reproducibility. Reaching the full potential of DTs in healthcare will depend on
a careful balance between technical innovation and implementation discipline. Efforts
to improve model generalizability, explainability, and adaptability must go hand in hand
with safeguards that ensure patient safety, data protection, and ethical use. Cross-dis-
ciplinary collaboration spanning clinical practice, engineering, data science, and health
policy will be central to advancing these technologies responsibly. The evidence leaves
no doubt, while technical foundations continue their rapid evolution, parallel progress in
ethical and operational frameworks must accelerate to match their growth an imperative
this review crystallizes through its comprehensive analysis of both achieved milestones
and the critical challenges that will define the next era of healthcare innovation.

**Abbreviations**
AI Artificial intelligence
AS Aortic stenosis
AUPRC Area under the precision-recall curve
AUROC Area under the receiver operating characteristic curve
BERT Bidirectional encoder representations from transformers


CGM Continuous glucose monitoring
CLGP Categorical latent Gaussian process
CPPS Cyber-physical production systems
CT Computed tomography
CTGAN Conditional tabular generative adversarial network
CVD Cardiovascular disease
DICE Dice similarity coefficient
DSS Decision support system
DT Digital twin
DTSM Digital twin for stress management
E-DAIC Extended distress analysis interview corpus
ECG Electrocardiogram
EHR Electronic health records
FHR Fetal heart rate
FHRV Fetal heart rate variability
GAN Generative adversarial network
GPT Generative pre-trained transformer
HbA1c Hemoglobin A1c
HRV Heart rate variability
IBLL Binomial log-likelihood
ICU Intensive Care Unit
IoU Intersection over union
IoT Internet of things
LCSA Lung cancer survival analysis
LLM Large language model
LR Logistic regression
MAE Mean absolute error
MAPE Mean absolute percentage error
MC-MedGAN Multi-categorical medical generative adversarial network
MDI Multiple daily insulin injections
MIMIC-IV Medical information mart for intensive care IV
miRNA MicroRNA
MPoM Mixture of product of multinomials
MSE Mean squared error
NASA National Aeronautics and Space Administration
NCD Non-communicable disease
NLP Natural language processing
NSCLC Non-small cell lung cancer
OF-kNN Optimized fuzzy-based k-nearest neighbor
PET Positron emission tomography
PPGR Postprandial glycemic response
QC Quality control
REaLTabFormer Realistic relational and tabular transformer
REFORM Registry for migraine study
RMSE Root mean square error
SCLC Small cell lung cancer
TAVR Transcatheter aortic valve replacement
T1D Type 1 diabetes
T2D Type 2 diabetes
TVAE Tabular variational autoencoder
TWIN-GPT Digital twin generative pre-trained transformer

**Supplementary Information**
The online version contains supplementary material available at https:// doi. org/ 10. 1186/ s40537- 025- 01280-w.

```
Additional file 1
```
**Acknowledgements**
The authors acknowledge the contributions of researchers in the field whose work formed the foundation for this review.
**Author contributions**
Conceptualization, ZG, MTA and RA; analysis, ZG, MTA and RA; methodology, ZG, MTA and RA.; project administration, RA.;
supervision RA; validation, ZG, MTA and RA; writing–original draft, ZG and MTA; writing—review and editing, ZG, MTA
and RA. All authors have read and agreed to the published version of the manuscript.
**Funding**
No funding was received for the completion of this study. All work, including the design, analysis, and manuscript
preparation, was conducted independently by the authors without financial support from any institution, company, or
funding body.


**Data availability**
No datasets were generated or analysed during the current study.

**Declarations
Ethics approval and consent to participate**
Not applicable. This study is a review of existing literature and does not involve any human participants, human data,
human tissue, or animal subjects.
**Consent for publication**
This study is a literature-based review and does not include any individual person’s data in any form.
**Competing interests**
The authors declare no competing interests.

Received: 1 January 2025 Accepted: 7 September 2025

**References**

1. Pavelić K, Kraljević Pavelić S, Sedić M. In: Bodiroga-Vukobrat N, Rukavina D, Pavelić K, Sander GG, editors. Personalized
    medicine. Berlin: Springer International Publishing; 2016. p. 1–19.
2. Savoia C, Volpe M, Grassi G, Borghi C, Agabiti Rosei E, Touyz RM. Personalized medicine—a modern approach for the
    diagnosis and management of hypertension. Clin Sci. 2017;131(22):2671–85.
3. Oostrom SH, Gijsen R, Stirbu I, Korevaar JC, Schellevis FG, Picavet HSJ, et al. Time trends in prevalence of chronic
    diseases and multimorbidity not only due to aging: data from general practices and health surveys. PLoS ONE.
    2016;11(8):0160264.
4. Dash S, Shakyawar SK, Sharma M, Kaushik S. Big data in healthcare: management, analysis and future prospects. J
    Big Data. 2019;6(1):1–25.
5. Soerjomataram I, Bray F. Planning for tomorrow: global cancer incidence and the role of prevention 2020–2070. Nat
    Rev Clin Oncol. 2021;18(10):663–72.
6. Siegel RL, Giaquinto AN, Jemal A. Cancer statistics, 2024. CA Cancer J Clin. 2024;74(1):12–49. https:// doi. org/ 10. 3322/
    caac. 21820.
7. Filip R, Gheorghita Puscaselu R, Anchidin-Norocel L, Dimian M, Savage WK. Global challenges to public health care
    systems during the Covid-19 pandemic: a review of pandemic measures and problems. J Pers Med. 2022;12(8):1295.
8. Kamel Boulos MN, Zhang P. Digital twins: from personalised medicine to precision public health. J Pers Med.
    2021;11(8):745.
9. Mohamed N, Al-Jaroodi J, Jawhar I, Kesserwan N. Leveraging digital twins for healthcare systems engineering. IEEE
    Access. 2023;11:69841–53. https:// doi. org/ 10. 1109/ ACCESS. 2023. 32921 19.
10. Datta SPA. Emergence of digital twins. arXiv preprint arXiv: 1610. 06467 2016
11. Aivaliotis P, Georgoulias K, Chryssolouris G. The use of digital twin for predictive maintenance in manufacturing. Int J
    Comput Integr Manuf. 2019;32(11):1067–80.
12. Laubenbacher R, Sluka JP, Glazier JA. Using digital twins in viral infection. Science. 2021;371(6534):1105–6.
13. Singh M, Srivastava R, Fuenmayor E, Kuts V, Qiao Y, Murray N, et al. Applications of digital twin across industries: A
    review. Appl Sci. 2022;12(11):5727.
14. Boyes H, Watson T. Digital twins: an analysis framework and open issues. Comput Ind. 2022;143:103763.
15. Allen BD. Digital twins and living models at NASA. In: Digital Twin Summit 2021.
16. Shafto M, Conroy M, Doyle R, Glaessgen E, Kemp C, LeMoigne J, et al. Draft modeling, simulation, information tech-
    nology & processing roadmap. Technol Area. 2010;11:1–32.
17. Ali WA, Fanti MP, Roccotelli M, Ranieri L. A review of digital twin technology for electric and autonomous vehicles.
    Appl Sci. 2023;13(10):5871.
18. Schwarz C, Wang Z. The role of digital twins in connected and automated vehicles. IEEE Intell Transp Syst Mag.
    2022;14(6):41–51.
19. Shadrin S, Makarova D, Ivanov A, Maklakov N. Safety assessment of highly automated vehicles using digital twin
    technology. In: 2021 Intelligent Technologies and Electronic Devices in Vehicle and Road Transport Complex (TIR-
    VED), IEEE; 2021. p. 1–5.
20. Almeaibed S, Al-Rubaye S, Tsourdos A, Avdelidis NP. Digital twin analysis to promote safety and security in autono-
    mous vehicles. IEEE Commun Standards Mag. 2021;5(1):40–6.
21. Lopes MR, Costigliola A, Pinto R, Vieira S, Sousa JM. Pharmaceutical quality control laboratory digital twin-a novel
    governance model for resource planning and scheduling. Int J Prod Res. 2020;58(21):6553–67.
22. Coito T, Martins MS, Firme B, Figueiredo J, Vieira SM, Sousa JM. Assessing the impact of automation in pharmaceuti-
    cal quality control labs using a digital twin. J Manuf Syst. 2022;62:270–85.
23. Birkle C, Pendlebury DA, Schnell J, Adams J. Web of science as a data source for research on scientific and scholarly
    activity. Quant Sci Stud. 2020;1(1):363–76.
24. Baas J, Schotten M, Plume A, Côté G, Karimi R. Scopus as a curated, high-quality bibliometric data source for aca-
    demic research in quantitative science studies. Quant Sci Stud. 2020;1(1):377–86.
25. Rouhollahi A, Willi JN, Haltmeier S, Mehrtash A, Straughan R, Javadikasgari H, et al. Cardiovision: a fully automated
    deep learning package for medical image segmentation and reconstruction generating digital twins for patients
    with aortic stenosis. Comput Med Imaging Graph. 2023;109:102289.


26. Dervisoglu H, Ülver B, Yurtoglu RA, Halepmollasi R, Haklidir M. A comparative study on cloud-based and edge-based
    digital twin frameworks for prediction of cardiovascular disease. In: ICT4AWE, 2023;p. 159–169
27. Shamanna P, Saboo B, Damodharan S, Mohammed J, Mohamed M, Poon T, et al. Reducing hba1c in type 2
    diabetes using digital twin technology-enabled precision nutrition: a retrospective analysis. Diabetes Therapy.
    2020;11:2703–14.
28. Abirami L, Karthikeyan J. Digital twin-based healthcare system (DTHS) for earlier Parkinson disease identification and
    diagnosis using optimized fuzzy based k-nearest neighbor classifier model. IEEE Access. 2023;11:96661–72. https://
    doi. org/ 10. 1109/ ACCESS. 2023. 33122 78.
29. Abilkaiyrkyzy A, Laamarti F, Hamdi M, Saddik AE. Dialogue system for early mental illness detection: toward a digital
    twin solution. IEEE Access. 2024;12:2007–24. https:// doi. org/ 10. 1109/ ACCESS. 2023. 33487 83.
30. Sarp S, Kuzlu M, Zhao Y, Gueler O. Digital twin in healthcare: a study for chronic wound management. IEEE J Biomed
    Health Inform. 2023;27(11):5634–43. https:// doi. org/ 10. 1109/ JBHI. 2023. 32990 28.
31. Avanzato R, Beritelli F, Lombardo A, Ricci C. Lung-DT: an AI-powered digital twin framework for thoracic health
    monitoring and diagnosis. Sensors. 2024;24(3):958.
32. Kolekar SS, Chen H, Kim K. Design of precision medicine web-service platform towards health care digital twin. In:
    2023 Fourteenth International Conference on Ubiquitous and Future Networks (ICUFN). IEEE; 2023. p. 843–848.
33. Kumi S, Ray M, Walia S, Lomotey RK, Deters R. Digital twins for stress management utilizing synthetic data. In: 2024
    IEEE World AI IoT Congress (AIIoT ). IEEE; 2024. p. 329–335.
34. Wang Y, Fu T, Xu Y, Ma Z, Xu H, Du B, et al. Twin-GPT: digital twins for clinical trials via large language model. ACM
    Trans Multimedia Comput Commun Appl. 2024. https:// doi. org/ 10. 1145/ 36748 38.
35. Makarov N, Bordukova M, Rodriguez-Esteban R, Schmich F, Menden MP. Large language models forecast patient
    health trajectories enabling digital twins. medRxiv. 2024. https:// doi. org/ 10. 1101/ 2024. 07. 05. 24309 957.
36. Moore JH, Li X, Chang J-H, Tatonetti NP, Theodorescu D, Chen Y, Asselbergs FW, Venkatesan M, Wang ZP. Syntwin:
    a graph-based approach for predicting clinical outcomes using digital twins derived from synthetic patients. In:
    Pacific Symposium on Biocomputing 2024. World Scientific; 2023. p. 96–107.
37. Carabello BA, Paulus WJ. Aortic stenosis. The Lancet. 2009;373(9667):956–66.
38. Cribier A. The development of transcatheter aortic valve replacement (TAVR). Global Cardiol Sci Practice.
    2016;2016(4):e201632.
39. Jaccard P. The distribution of the flora in the alpine zone. 1. New Phytol. 1912;11(2):37–50.
40. Freeman RK, Garite TJ, Nageotte MP. Fetal heart rate monitoring. Philadelphia: Lippincott Williams & Wilkins; 2003.
41. Lwin TC, Zin TT, Tin P, Ikenoue T, Kino E. Enhancing fetal heart rate monitoring through digital twin technology. In:
    2024 IEEE Gaming, Entertainment, and Media Conference (GEM). IEEE; 2024. p. 1–4.
42. Zizzo AR, Kirkegaard I, Hansen J, Uldbjerg N, Mølgaard H. Fetal heart rate variability is affected by fetal movements: a
    systematic review. Front Physiol. 2020;11:578898.
43. Bein B. Entropy. Best Practice Res Clin Anaesthesiol. 2006;20(1):101–9.
44. Olofsson P. Umbilical cord pH, blood gases, and lactate at birth: normal values, interpretation, and clinical utility. Am
    J Obstet Gynecol. 2023;228(5):1222–40.
45. Bousseljot R, Kreiseler D, Schnabel A. Nutzung der ekg-signaldatenbank cardiodat der ptb über das internet. Biomed
    Eng. 1995;40(1):317–8. https:// doi. org/ 10. 1515/ bmte. 1995. 40. s1. 317.
46. Kleinbaum DG, Dietz K, Gail M, Klein M, Klein M. Logistic regression. New York: Springer; 2002.
47. Natekin A, Knoll A. Gradient boosting machines, a tutorial. Front Neurorobot. 2013;7:21.
48. Chu Y, Li S, Tang J, Wu H. The potential of the medical digital twin in diabetes management: a review. Front Med.
    2023;10:1178912.
49. Thamotharan P, Srinivasan S, Kesavadev J, Krishnan G, Mohan V, Seshadhri S, et al. Human digital twin for personal-
    ized elderly type 2 diabetes management. J Clin Med. 2023;12(6):2094.
50. Cappon G, Pellizzari E, Cossu L, Sparacino G, Deodati A, Schiaffini R, Cianfarani S, Facchinetti A. System architecture
    of twin: A new digital twin-based clinical decision support system for type 1 diabetes management in children. In:
    2023 IEEE 19th International Conference on Body Sensor Networks (BSN). IEEE; 2023. p. 1–4.
51. Daneman D. Type 1 diabetes. The Lancet. 2006;367(9513):847–58.
52. Ben-Yacov O, Godneva A, Rein M, Shilo S, Kolobkov D, Koren N, et al. Personalized postprandial glucose response-
    targeting diet versus mediterranean diet for glycemic control in prediabetes. Diabetes Care. 2021;44(9):1980–91.
53. Gazerani P. Intelligent digital twins for personalized migraine care. J Pers Med. 2023;13(8):1255.
54. Ferrari MD, Goadsby PJ, Burstein R, et al. Migraine. Nat Rev Dis Primers. 2022;8(1):2.
55. Grodzka O, Slyk S, Domitrz I. The role of microrna in migraine: a systemic literature review. Cell Mol Neurobiol.
    2023;43(7):3315–27.
56. Karlsson WK, Ashina H, Cullum CK, Christensen RH, Al-Khazali HM, Amin FM, et al. The registry for migraine (reform)
    study: methodology, demographics, and baseline clinical characteristics. J Headache Pain. 2023;24(1):70.
57. Andreou AP, Fuccaro M, Lambru G. The role of erenumab in the treatment of migraine. Ther Adv Neurol Disord.
    2020;13:1756286420927119.
58. Nguyen TA, Pham T, Vu HTT, Nguyen TX, Vu TT, Nguyen BTT, et al. Use of potentially inappropriate medica-
    tions in people with dementia in Vietnam and its associated factors. Am J Alzheimer’s Dis Other Dementias ®.
    2018;33(7):423–32.
59. Wickramasinghe N, Ulapane N, Andargoli A, Ossai C, Shuakat N, Nguyen T, et al. Digital twins to enable better preci-
    sion and personalized dementia care. JAMIA Open. 2022;5(3):072.
60. Little MA, McSharry PE, Roberts SJ, Costello DA, Moroz IM. Exploiting nonlinear recurrence and fractal scaling prop-
    erties for voice disorder detection. Biomed Eng Online. 2007;6:23. https:// doi. org/ 10. 1186/ 1475- 925X-6- 23.
61. Parkinsons Data Set, UCI Machine Learning Repository. Oxford Parkinson’s Disease Detection Dataset. 8:2020
62. Devlin J. Bert: Pre-training of deep bidirectional transformers for language understanding. arXiv preprint arXiv: 1810.
    04805, 2018


63. Gratch J, Artstein R, Lucas GM, Stratou G, Scherer S, Nazarian A, Wood R, Boberg J, DeVault D, Marsella S, Traum DR.
    The distress analysis interview corpus of human and computer interviews. In: Proceedings of the Ninth International
    Conference on Language Resources and Evaluation (LREC 2014), 2014; p. 3123–3128
64. Han G, Ceilley R. Chronic wound healing: a review of current management and treatments. Adv Ther.
    2017;34:599–610.
65. Goodfellow I, Pouget-Abadie J, Mirza M, Xu B, Warde-Farley D, Ozair S, et al. Generative adversarial networks. Com-
    mun ACM. 2020;63(11):139–44.
66. Yuki K, Fujiogi M, Koutsogiannaki S. Covid-19 pathophysiology: a review. Clin Immunol. 2020;215:108427.
67. YOLOv8, Roboflow. Available online: https:// blog. robofl ow. com/ whats- new- in- yolov8/ (accessed on 15 December
    2023) 2023
68. He K, Zhang X, Ren S, Sun J. Deep residual learning for image recognition. In: Proceedings of the IEEE Conference on
    Computer Vision and Pattern Recognition, 2016. p. 770–778.
69. Dao D-P, Yang H-J, Ho N-H, Pant S, Kim S-H, Lee G-S, Oh I-J, Kang S-R. Survival analysis based on lung tumor segmen-
    tation using global context-aware transformer in multimodality. In: 2022 26th International Conference on Pattern
    Recognition (ICPR). IEEE; 2022. p. 5162–5169.
70. Willmott CJ, Matsuura K. Advantages of the mean absolute error (MAE) over the root mean square error (RMSE) in
    assessing average model performance. Climate Res. 2005;30(1):79–82.
71. Melo F. Area under the ROC curve. In: Dubitzky W, Wolkenhauer O, Cho K-H, Yokota H, editors. Encyclopedia of
    systems biology. New York, NY: Springer; 2013. p. 38–9.
72. De Benedictis A, Mazzocca N, Somma A, Strigaro C. Digital twins in healthcare: an architectural proposal and its
    application in a social distancing case study. IEEE J Biomed Health Inform. 2022;27(10):5143–54.
73. Xu L, Skoularidou M, Cuesta-Infante A, Veeramachaneni K. Modeling tabular data using conditional GAN. Advances
    in Neural Information Processing Systems 2019;32.
74. Patki N, Wedge R, Veeramachaneni K. The synthetic data vault. In: 2016 IEEE International Conference on Data Sci-
    ence and Advanced Analytics (DSAA). IEEE; 2016. p. 399–410.
75. Solatorio AV, Dupriez O. Realtabformer: Generating realistic relational and tabular data using transformers. arXiv
    preprint arXiv: 2302. 02041, 2023.
76. Borisov V, Seßler K, Leemann T, Pawelczyk M, Kasneci G. Language models are realistic tabular data generators. arXiv
    preprint arXiv: 2210. 06280, 2022.
77. Clusmann J, Kolbinger FR, Muti HS, Carrero ZI, Eckardt J-N, Laleh NG, et al. The future landscape of large language
    models in medicine. Commun Med. 2023;3(1):141.
78. Bhirud N, Tataale S, Randive S, Nahar S. A literature review on chatbots in healthcare domain. Int J Scientific Technol
    Res. 2019;8(7):225–31.
79. Seymour T, Frantsvog D, Graeber T. Electronic health records (EHR). Am J Health Sci. 2012;3(3):201.
80. OpenAI: ChatGPT. 2022.
81. Biswal S, Ghosh S, Duke J, Malin B, Stewart W, Xiao C, Sun J. Eva: Generating longitudinal electronic health records
    using conditional variational autoencoders. In: Machine Learning for Healthcare Conference. PMLR; 2021. p.
    260–282.
82. Zhang Z, Yan C, Lasko TA, Sun J, Malin BA. Synteg: a framework for temporal structured electronic health data simu-
    lation. J Am Med Inform Assoc. 2021;28(3):596–604.
83. Wang Z, Sun J. Promptehr: Conditional electronic healthcare records generation with prompt learning. arXiv pre-
    print arXiv: 2211. 01761, 2022.
84. Das T, Wang Z, Sun J. Twin: Personalized clinical trial digital twin generation. In: Proceedings of the 29th ACM SIG-
    KDD Conference on Knowledge Discovery and Data Mining. p. 402–413.
85. Labrak Y, Bazoge A, Morin E, Gourraud P-A, Rouvier M, Dufour R. Biomistral: A collection of open-source pretrained
    large language models for medical domains. arXiv preprint arXiv: 2402. 10373, 2024.
86. Danielsson P-E. Euclidean distance mapping. Comput Graphics Image Process. 1980;14(3):227–48.
87. Black PE. Manhattan Distance. In: Dictionary of Algorithms and Data Structures [online] 11 Feb 2019.
88. Gower JC. A general coefficient of similarity and some of its properties. Biometrics. 1971;1971:57–871.
89. Gal Y, Chen Y, Ghahramani Z. Latent gaussian processes for distribution estimation of multivariate categorical data.
    In: International Conference on Machine Learning. PMLR; 2015. p. 645–654.
90. Dunson DB, Xing C. Nonparametric Bayes modeling of multivariate categorical data. J Am Stat Assoc.
    2009;104(487):1042–51.
91. Choi E, Biswal S, Malin B, Duke J, Stewart WF, Sun J. Generating multi-label discrete patient records using generative
    adversarial networks. In: Machine Learning for Healthcare Conference. PMLR; 2017. p. 286–305.

**Publisher’s Note**
Springer Nature remains neutral with regard to jurisdictional claims in published maps and institutional affiliations.


