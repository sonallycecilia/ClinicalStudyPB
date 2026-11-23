export const consentTerm = {
  title: "TERMO DE CONSENTIMENTO E COMPROMISSO DO PARTICIPANTE",
  institution: "ClinicalStudyPB — Sistema de Gestão de Estudos Clínicos",
  version: "1.0",
  publication: "Novembro de 2026",
  sections: [
    {
      title: "1. Informações sobre a participação",
      blocks: [
        {
          type: "paragraph",
          text: "O ClinicalStudyPB é um sistema acadêmico destinado à simulação do gerenciamento e acompanhamento de estudos clínicos, utilizando dados fictícios.",
        },
        {
          type: "paragraph",
          text: "Os estudos representados no sistema têm como finalidade demonstrar atividades de pesquisa relacionadas à saúde, incluindo acompanhamento dos participantes, agendamento de visitas, registro de avaliações e histórico de participação.",
        },
        {
          type: "paragraph",
          text: "Este documento apresenta as condições gerais de participação nos estudos simulados acompanhados pela plataforma.",
        },
      ],
    },
    {
      title: "2. Participação voluntária",
      blocks: [
        {
          type: "paragraph",
          text: "A participação é livre e voluntária. O participante tem direito a receber informações claras sobre os estudos aos quais estiver vinculado, esclarecer dúvidas e conhecer os procedimentos, riscos e possíveis benefícios relacionados a cada pesquisa.",
        },
        {
          type: "paragraph",
          text: "O participante poderá recusar procedimentos ou solicitar sua retirada de um estudo a qualquer momento, sem penalidades ou prejuízo aos seus direitos.",
        },
      ],
    },
    {
      title: "3. Compromissos do participante",
      blocks: [
        {
          type: "paragraph",
          text: "Ao concordar com este termo, comprometo-me a:",
        },
        {
          type: "list",
          items: [
            "Fornecer informações verdadeiras e relevantes para o acompanhamento dos estudos.",
            "Seguir as orientações e os procedimentos previamente esclarecidos e aceitos.",
            "Comparecer às visitas agendadas sempre que possível, comunicando eventuais impedimentos.",
            "Informar à equipe responsável alterações no meu estado de saúde, desconfortos ou ocorrências relevantes.",
            "Comunicar dúvidas e solicitar esclarecimentos sempre que necessário.",
          ],
        },
        {
          type: "paragraph",
          text: "Esses compromissos não restringem minha liberdade de decisão nem meu direito de interromper a participação.",
        },
      ],
    },
    {
      title: "4. Riscos, benefícios e confidencialidade",
      blocks: [
        {
          type: "paragraph",
          text: "Estou ciente de que os procedimentos, riscos e possíveis benefícios variam conforme as características de cada estudo e devem ser esclarecidos antes de sua realização.",
        },
        {
          type: "paragraph",
          text: "As informações pessoais e os registros de acompanhamento deverão ser tratados com confidencialidade, respeitando os princípios de privacidade e proteção de dados previstos na Lei nº 13.709/2018 (LGPD).",
        },
        {
          type: "paragraph",
          text: "Por se tratar de uma simulação acadêmica, o ClinicalStudyPB não realiza procedimentos clínicos reais nem oferece tratamentos ou benefícios médicos.",
        },
      ],
    },
    {
      title: "5. Declaração de consentimento",
      blocks: [
        {
          type: "paragraph",
          text: "Declaro que li as informações apresentadas, tive a oportunidade de compreendê-las e estou ciente dos meus direitos e responsabilidades como participante dos estudos clínicos simulados no ClinicalStudyPB.",
        },
        {
          type: "strong",
          text: "Manifesto livremente minha concordância com as condições gerais de participação e acompanhamento descritas neste documento, reconhecendo meu direito de solicitar esclarecimentos ou interromper minha participação.",
        },
        {
          type: "declaration",
          before: "Ao selecionar ",
          emphasis: "“Li e concordo”",
          after:
            ", registro eletronicamente meu aceite, associado à minha conta, à data e à versão deste termo.",
        },
      ],
    },
  ],
} as const
