import { Link, useNavigate } from 'react-router-dom';
import { CandidateForm } from '../candidates/CandidateForm';
import { useRecruitmentStudies } from '../candidates/useRecruitmentStudies';

export function CandidateFormPage() {
  const navigate = useNavigate();
  const studies = useRecruitmentStudies();

  return <div className="coord-page candidate-form-page">
    <header className="coord-page-heading">
      <h1><Link to="/coordenador/candidatos">Candidatos e participantes</Link> <span aria-hidden="true">&gt;</span> Cadastrar candidato</h1>
    </header>
    <section className="study-form-panel candidate-form-panel" aria-labelledby="candidate-form-title">
      <div className="study-form-heading"><h2 id="candidate-form-title">Informações do candidato</h2></div>
      {/* O envio continua indisponível até a integração com a API de candidatos (S2-W2-06). */}
      <CandidateForm studies={studies} onCancel={() => navigate('/coordenador/candidatos')} />
    </section>
  </div>;
}
